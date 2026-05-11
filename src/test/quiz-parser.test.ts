/**
 * 测试选择题解析功能
 */

import { describe, it, expect } from 'vitest';
import { parseQuizText } from '../services/learning/quiz';

describe('Quiz Parser', () => {
  it('should parse 21 questions correctly', () => {
    // 创建21道题的测试数据
    const questions = [];
    for (let i = 1; i <= 21; i++) {
      questions.push(`${i}. 这是第${i}道题目？
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：A`);
    }
    
    const text = questions.join('\n\n');
    const parsed = parseQuizText(text);
    
    expect(parsed.length).toBe(21);
    
    // 验证每道题都被正确解析
    parsed.forEach((q, index) => {
      expect(q.question).toContain(`第${index + 1}道题目`);
      expect(q.options.length).toBe(4);
      expect(q.correctAnswer).toBe('选项A');
    });
  });

  it('should parse questions with different number formats', () => {
    const text = `1. 题目1
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：A

2、题目2
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：B

3）题目3
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：C`;

    const parsed = parseQuizText(text);
    
    expect(parsed.length).toBe(3);
    expect(parsed[0].correctAnswer).toBe('选项A');
    expect(parsed[1].correctAnswer).toBe('选项B');
    expect(parsed[2].correctAnswer).toBe('选项C');
  });

  it('should handle questions 11-20 correctly', () => {
    const text = `11. 第11题
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：A

15. 第15题
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：B

20. 第20题
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：C`;

    const parsed = parseQuizText(text);
    
    expect(parsed.length).toBe(3);
    expect(parsed[0].question).toContain('第11题');
    expect(parsed[1].question).toContain('第15题');
    expect(parsed[2].question).toContain('第20题');
  });

  it('should parse questions with inline options (same line)', () => {
    const text = `1、-19的8位补码定点数表示是（  ）。A. 10010100                        B. 11101011C. 01101101                        D. 11101101
2、假定带符号整数采用补码表示，若int型变量x和y的机器数分别是FFFF FFDFH和0000 0041H，则x、y的值以及x-y的机器数分别是(   )。A.x=-33,y=65,x-y的机器数为FFFF FF9EHB.x=-33,y=65,x-y的机器数为FFFF FF9DHC.x=-65,y=41,x-y的机器数溢出D.x=-65,y=41,x-y 的机器数为FFFF FF96H
3、CPI是（  ）。A．  一段程序执行中，平均到每条指令的指令周期数。B．  一段程序执行中，平均到每条指令的机器周期数。C．  一段程序执行中，平均到每条指令的时钟周期数。D．  一段程序执行中，平均到每条指令的总线周期数。`;

    const parsed = parseQuizText(text);
    
    expect(parsed.length).toBe(3);
    expect(parsed[0].question).toContain('-19的8位补码');
    expect(parsed[0].options.length).toBe(4);
    expect(parsed[1].question).toContain('补码表示');
    expect(parsed[2].question).toContain('CPI');
  });

  it('should parse 24 computer science questions', () => {
    const text = `1、-19的8位补码定点数表示是（  ）。A. 10010100                        B. 11101011C. 01101101                        D. 111011012、假定带符号整数采用补码表示，若int型变量x和y的机器数分别是FFFF FFDFH和0000 0041H，则x、y的值以及x-y的机器数分别是(   )。课本87页A.x=-33,y=65,x-y的机器数为FFFF FF9EHB.x=-33,y=65,x-y的机器数为FFFF FF9DHC.x=-65,y=41,x-y的机器数溢出D.x=-65,y=41,x-y 的机器数为FFFF FF96H  3、CPI是（  ）。A．  一段程序执行中，平均到每条指令的指令周期数。B．  一段程序执行中，平均到每条指令的机器周期数。C．  一段程序执行中，平均到每条指令的时钟周期数。D．  一段程序执行中，平均到每条指令的总线周期数。4、计算机体系结构是（     ）能看到的机器的属性，即机器的概念性结构和功能特性。A． CPU设计者                       B. 最终用户    C． 高级语言程序员                   D.汇编语言程序员5、CPU中的数据地址MAR寄存器对（    ）是不透明的。A. 汇编语言程序员                    B. 高级语言程序员C. CPU设计者                         D. 系统管理员6、一个程序载入内存后，通常可以包含（     ）：A. 多个代码段、多个数据段、多个堆栈段B. 有多个代码段和数据段，一个堆栈段C. 只能有一个代码段、一个数据段、一个堆栈段          D . 一个代码段、一个堆栈段和多个数据段7、计算机主频的周期是指（      ）。A.指令周期                          B.执行周期    C.机器周期                          D.时钟周期8、计算机实现是（    ）。A.计算机组成的物理实现B.计算机体系结构的物理实现C.计算机组成的逻辑实现D.计算机体系结构的逻辑实现9、具有16条地址线的CPU可寻址空间的个数为（      ）。A. 256                         B. 65535C. 131072                      D. 6553610、有关运算器的描述，（      ）是正确的。A.只做加法                     B.只做算术运算C.既做算术运算又做逻辑运算     D.只做逻辑运算11、计算机硬件能直接执行的只有(      )。A.符号语言                     B .机器语言     C.汇编语言                     D .机器语言和汇编语言12、总线的（    ）指的是总线一次同时传送的信息位数或需要的线数。A. 位宽                             B. 带宽C. 频率                             D. 传输速率13、对于逻辑移位和算术移位（        ）。课本55页A.逻辑移位不考虑数据的符号，算术移位不考虑数据的符号B.逻辑移位不考虑数据的符号，算术移位考虑数据的符号    C.逻辑移位考虑数据的符号，算术移位考虑数据的符号D.逻辑移位考虑数据的符号，算术移位不考虑数据的符号14、CPU中跟踪指令后继地址的寄存器是（     ）。A．地址寄存器   B.通用寄存器   C.指令寄存器   D.程序计数器 15、对汇编语言程序员可见的属性是 (        ）。A. 寻址方式、数据传动的方式、MAR寄存器B. 指令集、MAR寄存器、MBR寄存器C. 指令集、寻址方式、数据表示D. 指令集、算术逻辑单元、处理器工作需要的控制信号16、评价计算机性能最重要的指标是（       ）。A. 主存容量                         B.基本字长C. 处理器主频                       D. 处理速度17、（    ）指令是为了完成主机与外部设备之间信息交换的各种操作而设置的。A. 逻辑运算                        B. 算术运算C. 位操作                          D. 输入输出18、下列哪个存储器的容量为640K存储器（       ）。A. 640*103字节的存储器             B. 640*103位的存储器C. 640*210字节的存储器               D. 640*210位的存储器19、存储单元是指（      ）。A. 存放一个存储字的所有存储元集合    B. 存放一个字节的所有存储元集合C. 存放一个二进制信息位的存储元集合D. 存放一条指令的存储元集合20、微程序控制器中，机器指令与微指令的关系是（    ）。A．每一条机器指令由一段用微指令编成的微程序来解释执行B．每一条机器指令由一条微指令来执行C． 一段机器指令组成的程序可由一条微指令来执行D． 一条微指令由若干条机器指令组成21、采用DMA方式传送数据时，每传送一个数据就要用（       ）时间。A.一个指令周期                         B.一个时钟周期C. 两个存储周期                        D.一个存储周期22、中断服务程序的最后一条指令是（   ）A.RET                                   B.PUSH    C.IRET                                  D.POP23、CPU中的通用寄存器位数取决于（     ）。A.存储器的容量                          B.机器字长    C.指令的长度                            D.以上都不对24、双端口存储器所以能进行高速读/写操作，是因为采用（   ）。A.  高速芯片    B.  新型器件C.  流水技术    D.  两套相互独立的读写电路`;

    const parsed = parseQuizText(text);
    
    // 应该解析出24道题
    expect(parsed.length).toBe(24);
    
    // 验证第一题
    expect(parsed[0].question).toContain('-19的8位补码');
    expect(parsed[0].options.length).toBe(4);
    
    // 验证最后一题
    expect(parsed[23].question).toContain('双端口存储器');
  });
});


import { parseJudgmentText, autoParseQuestions } from '../services/learning/quiz';

describe('Judgment Question Parser', () => {
  it('should parse 20 judgment questions', () => {
    const text = `1．当一个进程从等待态变成就绪态，就一定有一个进程从就绪态变成运行态。答案：×2．在请求页式存储管理中，页面淘汰所花费的时间不属于系统开销。答案：×3．在中断处理过程中，必须屏蔽中断。答案：×4．在有虚拟存储器的系统中，可以运行比主存容量还大的程序。答案：√5．打印机是一类典型的字符设备。答案：√6.原语可以被多个进程同时执行。答案：×7.对文件进行检索时，检索的起点必须是根目录而不是其他目录。答案：×8．并发性是指若干个事件在不同的时刻发生。答案：×9．死锁是系统中的全部进程都处于阻塞状态。答案：×10．在用P，V操作解决进程之间的同步与互斥时，一定要正确地安排P，V操作的顺序，否则会引起死锁。答案：√11．采用缓冲技术，可以缓冲CPU与外设之间的速度不匹配问题。答案：√12．在一个纯批处理系统中，采用时间片技术会降低系统的工作效率。答案：√13．动态重定位是在作业的装入过程中进行的。答案：×14．设备在I/O操作时，可以不需要CPU干预。答案：√15．页式存储管理技术比段式存储管理技术效率更高，实现更容易。()答案：×16．数据库管理程序需要调用操作系统程序，操作系统程序的实现也需要数据库系统的支持。答案：×17．操作系统为用户提供的接口有键盘命令和原语。答案：×18．线程是进程的另一种称呼。答案：×19．通道也可以执行程序，但构成程序的指令是特定的几条指令。答案：√20．资源的利用率高和系统的工作效率高是一回事。答案：×`;

    const parsed = parseJudgmentText(text);
    
    expect(parsed.length).toBe(20);
    
    // 验证第一题
    expect(parsed[0].question).toContain('进程从等待态变成就绪态');
    expect(parsed[0].correctAnswer).toBe('错');
    expect(parsed[0].type).toBe('judgment');
    
    // 验证第4题（答案为√）
    expect(parsed[3].question).toContain('虚拟存储器');
    expect(parsed[3].correctAnswer).toBe('对');
    
    // 验证最后一题
    expect(parsed[19].question).toContain('资源的利用率');
    expect(parsed[19].correctAnswer).toBe('错');
  });

  it('should auto-detect judgment questions', () => {
    const text = `1．进程是程序的一次执行。答案：√
2．线程是进程的另一种称呼。答案：×`;

    const result = autoParseQuestions(text);
    
    expect(result.type).toBe('judgment');
    expect(result.questions.length).toBe(2);
    expect(result.questions[0].correctAnswer).toBe('对');
    expect(result.questions[1].correctAnswer).toBe('错');
  });
});
