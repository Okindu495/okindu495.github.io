---
title: Go笔记
description: Go 语言底层复习 — 并发调度 / 内存 GC / 工程实践
---

# Go笔记

**摘要：** Go 语言底层复习：并发怎么调度、内存谁分配谁回收、工程怎么写对。与《Agent手册》的分工：手册讲 Agent 系统，本篇讲语言底座；缓存一致性等偏硬件内容见《基础笔记》，MySQL/Redis 串场见《存储笔记》。

**怎么读：** 三条线——§1 并发（GMP 调度 + channel + 锁）、§2 内存（分配器 + GC + 逃逸）、§3–§5 类型坑与工程（框架、可观测、性能十式）。每节先给结论，再给机制，标"常问"的是高频口述点。

## 1. Goroutine 与 GMP 调度

**一句话：Go 把"线程"拆成三层——G 是任务，M 是干活的 OS 线程，P 是持本地队列的调度器；切换在用户态，开销极小。**

### 1.1 线程模型与 GMP

- 线程模型：1:1（内核级线程）、N:1（用户级线程）、M:N（两级线程模型）。Goroutine 基于 M:N，由 Go runtime 调度。
- G（goroutine）：轻量执行单元，初始栈 2KB（OS 线程通常 2–8MB），可按需扩到 1GB（64 位）。
- M（machine）：OS 线程，真正执行代码。
- P（processor）：逻辑处理器抽象，持有可运行队列与运行时资源；通过本地队列 + work-stealing 减少锁竞争。
- G 的状态（常问）：_Gidle（刚分配）、_Grunnable（队列等待）、_Grunning（M 上执行）、_Gsyscall（系统调用中）、_Gwaiting（等 channel/锁）、_Gdead（结束）。

### 1.2 阻塞、抢占与泄漏

- **常问：G 什么时候阻塞？** channel 读写（读空、写满）、网络 I/O（netpoller 接管，不占 M）、锁竞争、系统调用（M 可被剥夺 P）、`time.Sleep` / `runtime.Gosched()`。
- **抢占（常问）：** Go 1.14+ 支持异步抢占。sysmon 发现某 G 运行超 ~10ms，发 SIGURG 强制让出，解决长循环饿死其他 G；GC 栈扫描也靠 safepoint 让 G 尽快进入可扫描状态。
- **自旋占 CPU 怎么解：** 先定位（忙轮询 `for {}`、锁自旋、`select default` 热循环），再改阻塞等待（channel/cond）、加退避与 `time.Sleep`、拆锁降争用、必要时调 `GOMAXPROCS`。
- **goroutine 泄漏（常问）：** 发送/接收永远等不到、未关闭的 channel、未取消的 context、timer 泄漏、`WaitGroup` Add/Done 不匹配、无退出条件的无限循环。排查：pprof goroutine 看阻塞点，给每个 G 退出条件与超时。

## 2. Channel 与同步原语

**一句话：channel 是类型安全的同步点（常问），锁是临界区的门；Go 里优先用通信代替共享，共享躲不掉时锁粒度越小越好。**

### 2.1 channel（常问）

- 无缓冲：发送与接收必须同时发生，是同步点（handoff），用于严格顺序。
- 有缓冲：容量内发送不阻塞，用于削峰、解耦生产消费。
- `close` 表示"不会再发送"；接收用 `v, ok := <-ch` 判断关闭且耗尽；读已关闭 channel 得零值。
- **关闭三原则：** 只由发送方关闭；不对已关闭 channel 发送（panic）；不重复关闭（panic）。close 所有权必须在设计时定清楚。
- **底层 `hchan`：** 环形缓冲指针、元素大小、容量、读写索引、关闭标志、互斥锁、发送/接收等待队列（`waitq`，节点 `sudog`）。无缓冲走等待队列直接交接，有缓冲走环形数组。多个 goroutine 并发 send/recv 安全。
- `make(chan T, n)` 返回引用，底层 `hchan` 通常在堆上。
- **select：** 多路 channel 操作，多分支就绪时伪随机选防饥饿；`default` 分支易致 busy loop，要配 sleep/阻塞或退避。

顺序打印（cat/dog/fish 交替 100 次，channel 接力即答案）：

```go
cat := make(chan struct{})
dog := make(chan struct{})
fish := make(chan struct{})
go func() {
    for i := 0; i < 100; i++ {
        <-cat
        fmt.Println("cat")
        dog <- struct{}{}
    }
}()
go func() {
    for i := 0; i < 100; i++ {
        <-dog
        fmt.Println("dog")
        fish <- struct{}{}
    }
}()
done := make(chan struct{})
go func() {
    for i := 0; i < 100; i++ {
        <-fish
        fmt.Println("fish")
        if i == 99 {
            close(done)
            return
        }
        cat <- struct{}{}
    }
}()
cat <- struct{}{}
<-done
```

### 2.2 锁与原子操作

- **Mutex 是悲观锁（常问）：** 假设冲突会发生，先互斥再进临界区。乐观锁反之：先无锁改，用 CAS/版本号验冲突、失败重试。
- **Mutex 两种模式（常问）：** normal 偏吞吐（新来 G 与被唤醒 G 竞争）；starvation 偏公平（等太久的优先，防止尾延迟拉爆）。
- **底层：** 一个 `int32 state`（锁定/唤醒/饥饿/等待数）+ CAS + 信号量阻塞唤醒。竞争时会有限自旋，超阈值 park 让出 P；纯用户态无限自旋不可取。
- **RWMutex：** 多读并发、写独占，读多写少用；写会挡住后续读（防写饥饿）。
- **常问：项目里用过哪些锁？** `Mutex` / `RWMutex` / `Once` / `Cond` / `atomic`（计数器、状态机）/ channel 替代共享。经验点：锁粒度小、热点分片、锁顺序一致防死锁、临界区内不做 IO。
- **线程安全的三种写法：** 共享内存+同步（mutex/atomic/cond）、消息传递（状态收进单 goroutine 用 channel 序列化访问）、分片隔离（按 key 拆 shard 消灭共享写）。
- **Once/Cond/Pool：** Once 保初始化一次；Cond 等待/唤醒；Pool 复用临时对象降 GC（不保证命中）。高并发读写 map：`sync.Map` 适合读多写少，否则分段锁（见§5.4）。
- **atomic 注意：** 只保单变量，复合不变量仍要锁。

## 3. 内存、GC 与逃逸

**一句话：小对象走本地缓存，大对象走全局堆；GC 按"上次存活堆 × (1+GOGC)"触发三色标记；逃逸分析决定变量住栈还是住堆——压住逃逸就是压住 GC。**

### 3.1 分配器与 GC（常问）

- **分层（TCMalloc 思想）：** mcache（每 P 本地）→ mcentral（按 size class 共享）→ mheap（全局堆管 spans）。小对象按 size class 从 span 切（微小 <16B、小 16B–32KB、大 >32KB）；大对象单独大 span。
- **触发：** 堆分配达到上次存活堆 × (1 + GOGC/100)；也可定时或 `runtime.GC()` 手动；`debug.SetGCPercent` 调阈值。
- **三色标记：** 白（未访问）→ 灰（已访问、引用未处理）→ 黑（处理完）；并发标记 + 混合写屏障；调参看 GOGC、GOMEMLIMIT。
- **其他 GC 制式（对照用）：** 引用计数（怕环）、分代（朝生夕死）、复制/标记-清扫/标记-整理。

### 3.2 逃逸分析（常问）

- 编译器决定变量住栈（快，自动释放）还是住堆（慢，GC 管）。
- **五类必逃逸：** 返回局部指针；装进 `interface{}`（如 `fmt.Println(a)`）；变量过大超栈；被闭包长期引用；slice/map/channel 里存指针。
- 排查：`go build -gcflags="-m"` 看逃逸日志。
- **小对象多为什么 GC 压力大：** 分配频繁、标记对象多、指针追踪与写屏障开销大。看的是"存活对象数 × 指针图复杂度"，不是字节数。

### 3.3 OOM 与泄漏排查

- **常问：线程 OOM vs goroutine OOM？** 前者整进程被 OOM Killer SIGKILL；后者同样整进程 crash（`out of memory` 不可 recover）。
- **常见病因：** map 无界增长、slice 拽着大底层数组不放、缓存无淘汰、goroutine 泄漏、日志/队列堆积。
- **排查链：** pprof（heap/goroutine）→ 指标（RSS、heap inuse）→ 压测复现 → 加上界与淘汰 → 限流分页。

## 4. 类型、错误与并发习惯

**一句话：本节是"写对 Go"的坑位表——slice 分家、map 并发 panic、接口 nil、defer 只管当前 G，个个都是线上事故原型。**

- **slice（常问）：** 指针 + len + cap 描述符；append 可扩容"分家"；子切片拽大数组致泄漏，用 copy 断开。深拷贝用内建 `copy`。
- **map（常问）：** 哈希桶 + 溢出桶，负载因子渐进扩容；并发读写 panic。方案：加锁、分片、`sync.Map`（读多写少键稳定）。
- **interface nil（常问）：** 接口值 = 动态类型 + 动态值；`var e error = (*MyErr)(nil)` 的类型非空故 `e != nil`。返回前给真 nil。
- **make vs new：** `new(T)` 返回清零指针；`make` 只用于 slice/map/channel，返回引用本身并初始化内部结构。
- **传值还是传指针：** 大结构体传指针（省拷贝、可修改）；小结构体可传值（防逃逸、不可变）。
- **rune/uint：** `rune` = `int32` 别名（Unicode 码点），`for range` 字符串得 rune；无符号溢出按模回绕不抛异常，可疑处用 `math/bits` 或前置范围检查。
- **defer/panic/recover（常问）：** defer 后进先出；panic 沿栈展开执行 defer；recover 只能在 defer 里、只管当前 G，子 goroutine 各自处理。一个 G 未捕获 panic = 整进程崩溃。
- **错误处理：** `%w` 包裹留根因，顶层中间件统一收口；业务错误给码，系统错误 500。
- **context：** 跨 G 传取消/deadline/请求数据；`WithCancel/Timeout/Deadline` 用完调 cancel；ctx 放第一个参数，不塞结构体长期持有。
- **指令重排：** CPU/编译器会重排，靠 mutex、channel 收发、atomic 建立 happens-before；别信"volatile 式"直觉。

## 5. 工程：框架、可观测与标准库

**一句话：Web 层 Gin/net/http 起手，RPC 用 gRPC，DB 用 gorm；可观测 pprof + 日志先行；反射和 tag 是框架的筋。**

- **Gin（常问）：** `ShouldBindJSON` 绑参，底层 `go-playground/validator`（tag 如 `binding:"required,min=1,max=10"`）；中间件 `router.Use` + `c.Next()` 做 Auth/日志/限流；错误用 `c.Error` 收集、中间件 `c.Errors.Last()` 统一处理；自定义校验 `validator.Engine().RegisterValidation`，返回 bool。
- **net/http 高频：** 读/写/空闲超时必配；按接口限流、goroutine 与下游连接池隔离；`http.Server.Shutdown(ctx)` + 信号（`os/signal.Notify` 收 SIGTERM）优雅停，等 in-flight 做完。
- **testing/benchmark：** 表驱动、边界覆盖、不依赖外部环境；`b.ResetTimer()` 剔初始化，看 allocs/op。
- **pprof 三板斧：** CPU 看热点/锁竞争/自旋；heap 看 inuse/alloc 找大对象与泄漏；goroutine 看阻塞点。
- **反射与 tag：** `reflect.TypeOf(obj).Field(i).Tag.Get("json")` 取 tag；原理是拆 `eface` 的 `_type` + `data`；调函数 `reflect.ValueOf(fn).Call(...)`。性能开销大，只用在框架层。
- **标准库速记：** `net/http`（HandleFunc + 中间件）、`database/sql`（连接池 + 预处理）、`context`（取消超时）、`encoding/json`（tag 控字段，极热路径换 sonic）。

## 6. 性能优化八式

**一句话：少分配、少拷贝、少反射——八式全是这三件事的实例。**

1. **字符串拼接：** `+` 产中间对象，用 `strings.Builder`（先 `Grow` 预分配）。
2. **切片深拷贝：** 赋值只拷指针，用内建 `copy`。
3. **大文件拷贝：** `io.Copy` 在 Linux 自动走 `sendfile` 零拷贝；或 `mmap` 映射。
4. **临时大对象：** `sync.Pool` 复用（如 1KB buffer），`Get` 配 `defer Put`。
5. **周期任务：** `time.Ticker` + `defer Stop()`，防 `time.After` 循环堆积。
6. **JSON：** 极热路径 `encoding/json` 换 sonic（JIT）。
7. **日志：** `slog` 起手（1.21 官方结构化），极致性能换 zap。
8. **高并发读写 map：** 分段锁（32 shard 各配 RWMutex），命中读多写少才用 `sync.Map`。

```go
var bufPool = sync.Pool{New: func() interface{} { return make([]byte, 1024) }}
func process() {
    buf := bufPool.Get().([]byte)
    defer bufPool.Put(buf)
}
```

## 附：与他篇的边界

- 缓存一致性（MESI/伪共享/内存对齐）、Linux 信号语义 → 《基础笔记》。
- MySQL 锁与分库分表、Redis 分布式锁/主从集群/持久化 → 《存储笔记》。
- 负载均衡算法（轮询/一致性哈希/最少连接）→ 《系统设计笔记》。
