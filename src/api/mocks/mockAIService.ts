import type { Message, IAIService } from '../../domain/contracts/IAIService';

export class MockAIService implements IAIService {
  async callDeepSeekWithRetry(
    prompt: string,
    systemPrompt: string,
    _maxRetries?: number,
    _temperature?: number
  ): Promise<string> {
    console.log('[Mock AI Service] Handling prompt request:', { systemPrompt, prompt });
    
    // 1. Content Parsing (ParsedContent)
    if (systemPrompt.includes('政治学习内容解析助手') || prompt.includes('章节结构')) {
      return JSON.stringify({
        title: "马克思主义基本原理导论",
        chapters: [
          {
            id: "mock-chapter-1",
            title: "第一章 马克思主义是关于无产阶级和人类解放的科学",
            content: "马克思主义创立于19世纪中叶，是马克思和恩格斯在批判地继承人类优秀文化成果的基础上创立的。它是关于无产阶级和人类解放的科学，是关于自然、社会和思维发展一般规律的学说。马克思主义由马克思主义哲学、马克思主义政治经济学和科学社会主义三个部分组成。",
            keywords: ["马克思主义", "科学社会主义", "唯物主义"],
            order: 1
          },
          {
            id: "mock-chapter-2",
            title: "第二章 世界的物质性及发展规律",
            content: "世界的真正统一性在于它的物质性。物质是不依赖于人类的意识而存在，并能为人类的意识所反映的客观实在。运动是物质的根本属性和存在方式。空间和时间是运动着的物质的存在形式。唯物辩证法是关于普遍联系和永恒发展的科学，对立统一规律是唯物辩证法的实质和核心。",
            keywords: ["客观实在", "对立统一", "唯物辩证法"],
            order: 2
          }
        ],
        keywords: [
          {
            term: "马克思主义",
            definition: "由马克思和恩格斯创立的，关于自然、社会和思维发展一般规律的科学学说体系。",
            importance: "high"
          },
          {
            term: "客观实在",
            definition: "指不依赖于人的意识而存在，且能为人的意识所反映的客观存在物。是物质的唯一特性。",
            importance: "high"
          },
          {
            term: "对立统一规律",
            definition: "唯物辩证法的实质和核心，揭示了事物普遍联系的根本内容和永恒发展的内在动力。",
            importance: "high"
          }
        ],
        concepts: [
          {
            name: "世界的物质统一性",
            definition: "世界的真正统一性在于它的物质性，物质世界是多样性的统一。",
            relatedTerms: ["客观实在", "唯物主义"]
          },
          {
            name: "矛盾的普遍性与特殊性",
            definition: "矛盾无处不在无时不有，且每一事物的矛盾又各有其特定性质。二者在一定条件下可以相互转化。",
            relatedTerms: ["对立统一", "辩证法"]
          }
        ]
      }, null, 2);
    }

    // 2. Quiz Generation (GENERATE_QUIZ_PROMPT)
    if (systemPrompt.includes('选择题') || prompt.includes('选择题') || systemPrompt.includes('GENERATE_QUIZ_PROMPT')) {
      return JSON.stringify([
        {
          id: "mock-q-1",
          question: "唯物辩证法的实质和核心是（ ）。",
          options: [
            "对立统一规律",
            "质量互变规律",
            "否定之否定规律",
            "联系和发展的观点"
          ],
          correctAnswer: "对立统一规律",
          explanation: "对立统一规律揭示了事物普遍联系的根本内容和永恒发展的内在动力，提供了人们认识世界和改造世界的根本方法——矛盾分析法。因此，它是唯物辩证法的实质和核心。"
        },
        {
          id: "mock-q-2",
          question: "物质的唯一特性是（ ）。",
          options: [
            "客观实在性",
            "运动性",
            "可知性",
            "时空限制性"
          ],
          correctAnswer: "客观实在性",
          explanation: "马克思主义哲学认为，客观实在性是物质的唯一特性，它是不依赖于人的意识并能为人的意识所反映的客观实在。"
        },
        {
          id: "mock-q-3",
          question: "认识的本质是主体对客体的（ ）。",
          options: [
            "直观反映",
            "能动反映",
            "主观臆造",
            "消极照镜子"
          ],
          correctAnswer: "能动反映",
          explanation: "辩证唯物主义认识论认为，认识是主体在实践基础上对客体的能动反映，既有摹写性，又有创造性。"
        }
      ], null, 2);
    }

    // 3. Fill in the Blanks (GENERATE_FILL_BLANK_PROMPT)
    if (systemPrompt.includes('挖空') || prompt.includes('挖空') || systemPrompt.includes('GENERATE_FILL_BLANK_PROMPT')) {
      return JSON.stringify({
        text: "世界的真正统一性在于它的___1___。物质是不依赖于人类的___2___而存在，并能为人类的意识所反映的客观实在。",
        blanks: [
          {
            id: "mock-b-1",
            position: 12,
            length: 3,
            answer: "物质性",
            hint: "世界最本质的特征"
          },
          {
            id: "mock-b-2",
            position: 24,
            length: 2,
            answer: "意识",
            hint: "人的脑力与思维活动"
          }
        ]
      }, null, 2);
    }

    // 4. Term Matching (GENERATE_MATCHING_PROMPT)
    if (systemPrompt.includes('配对') || prompt.includes('配对') || systemPrompt.includes('GENERATE_MATCHING_PROMPT')) {
      return JSON.stringify([
        {
          id: "mock-m-1",
          term: "马克思主义哲学",
          definition: "关于自然、社会和思维发展一般规律的科学，是无产阶级的世界观和方法论。"
        },
        {
          id: "mock-m-2",
          term: "唯物辩证法",
          definition: "关于普遍联系和永恒发展的科学学说。"
        },
        {
          id: "mock-m-3",
          term: "认识论",
          definition: "关于认识的来源、本质、发展规律及真理标准的学说。"
        },
        {
          id: "mock-m-4",
          term: "唯物史观",
          definition: "关于人类社会发展一般规律的科学，认为社会存在决定社会意识。"
        }
      ], null, 2);
    }

    // 5. Weakness Analysis (GENERATE_WEAKNESS_ANALYSIS_PROMPT)
    if (systemPrompt.includes('薄弱点') || prompt.includes('错题') || systemPrompt.includes('GENERATE_WEAKNESS_ANALYSIS_PROMPT')) {
      return JSON.stringify({
        analysis: "### 深度解析\n您的薄弱点主要在于**唯物辩证法三大规律的混淆**，尤其是将“对立统一规律”（揭示动力）与“质量互变规律”（揭示形式、状态）混淆。\n1. **对立统一规律**：是实质与核心，解释了事物*为什么*发展。\n2. **质量互变规律**：解释了事物*如何*发展，揭示了量变积累到一定程度引起质变的状态。\n3. **否定之否定规律**：揭示了事物发展的*方向和道路*（螺旋式上升）。",
        mnemonic: "三大规律好区分：\n对立统一是核心，动力泉源这里寻；\n质量互变显形式，渐进突变看质均；\n否定之否定定方向，前途光明道路盘！",
        customQuestions: [
          {
            question: "事物发展的动力和源泉在于（ ）。",
            options: [
              "矛盾双方的对立统一",
              "量变积累到一定程度",
              "对旧事物的否定",
              "外力的推动作用"
            ],
            correctAnswer: "矛盾双方的对立统一",
            explanation: "矛盾是事物发展的动力。矛盾双方的对立统一（即矛盾的斗争性与同一性相结合）是事物发展的根本源泉和动力。"
          }
        ]
      }, null, 2);
    }

    // 6. Mnemonic generators (Various style parameters)
    if (systemPrompt.includes('口诀') || prompt.includes('口诀') || systemPrompt.includes('GENERATE_MNEMONIC')) {
      if (systemPrompt.includes('押韵') || prompt.includes('rhyme') || prompt.includes('押韵')) {
        return "唯物世界物质性，不依意识客观存。\n运动根本属与方，时空运动物质呈。\n联系发展辩证法，对立统一核心尊！";
      }
      if (systemPrompt.includes('动漫') || prompt.includes('anime') || prompt.includes('热血')) {
        return "【奥义·唯物物质斩】！\n燃烧吧，小宇宙！物质可是超越一切意识流的终极客观实在！\n用【对立统一矛盾杀】冲破虚无的黑暗，这就是我们必须要守护的科学真理信念！";
      }
      if (systemPrompt.includes('学术') || prompt.includes('academic') || prompt.includes('严谨')) {
        return "#### 逻辑框架体系\n1. **核心命题**：世界的物质统一性。\n2. **理论推演**：客观实在是不依赖主观意识的根本存在，运动作为客观实在的存在方式在时空中展开。\n3. **认识论归宿**：实践作为连接主体与客体的中介，是检验真理的唯一标准。";
      }
      if (systemPrompt.includes('大妈') || prompt.includes('grandma') || prompt.includes('顺口溜')) {
        return "大妹子你听我说，这世界啊全是实物！\n脑瓜子想得再美，也不如手里的大白菜踏实！\n矛盾矛盾天天有，有来有往才热闹，对立统一才是核心！";
      }
      if (systemPrompt.includes('故事') || prompt.includes('story')) {
        return "从前有个叫做‘客观实在’的石头，它非常喜欢运动。一天，它在‘时间’和‘空间’的草地上打滚，迎面碰到了叫做‘意识’的小花。石头对小花说：‘虽然你很美，但我不需要依赖你也能快乐地打滚！’这就是世界的物质性故事。";
      }
      if (systemPrompt.includes('对比') || prompt.includes('compare') || prompt.includes('表格')) {
        return "| 概念 | 本质特征 | 在事物发展中的作用 |\n| --- | --- | --- |\n| 唯物辩证法 | 普遍联系、永恒发展 | 根本的世界观和方法论 |\n| 形而上学 | 孤立、静止、片面 | 阻碍对客观世界发展规律的认识 |\n| 唯心主义 | 意识决定物质 | 偏离客观实践的科学轨道 |";
      }
      
      // Default fallback mnemonic
      return "物质第一意识二，客观实在不依心。\n运动根本时空载，对立统一辨矛盾！";
    }

    // Default universal fallback response
    return `[Mock Server Response for prompt: ${prompt.substring(0, 50)}]
    世界的物质统一性是马克思主义哲学的基石。`;
  }

  async callDeepSeekChatWithRetry(
    messages: Message[],
    _maxRetries?: number,
    _temperature?: number
  ): Promise<string> {
    console.log('[Mock AI Service] Handling chat messages request:', messages);
    
    const lastMessage = messages[messages.length - 1]?.content || '';
    
    // Delegate to callDeepSeekWithRetry for unified matching
    return this.callDeepSeekWithRetry(lastMessage, messages[0]?.content || '', _maxRetries, _temperature);
  }
}
