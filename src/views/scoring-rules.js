// 「评分规则」页：关系分析 v3 的完整计算口径。
// 数值全部取自 src/affinity/ 导出的常量与维度定义，界面说明与实际计算同源，不另写一份数字。
export const RECOGNITION_RULES = Object.freeze([
  {
    id: 'turns',
    title: '回合与对话段',
    detail:
      '同一人相邻消息间隔不超过 3 分钟合为一个回合；首次发言或与上一回合末尾间隔达到 120 分钟开启新对话段，该回合记为一次主动开启。时间按上海时区归入日期，周从周一开始。'
  },
  {
    id: 'bids',
    title: '连接邀请与回应',
    detail:
      '我方提问或分享的回合是一次连接邀请。对方下一回合：回答、承接、表达支持/具体感谢，或在同一对话段就该话题追问 → 转向；带摩擦或明确拒绝 → 对立；其他 → 转离；下一回合不是对方或间隔 ≥ 24 小时 → 未回复，不计入回应性分母。'
  },
  {
    id: 'answer',
    title: '回答与承接',
    detail:
      '结合上一轮的问题、建议与话题判断：时间、地点、数量与是非问题分别匹配答案特征；话题承接要求词语关联或同类主题。单次应和与笑声按中性处理。回答与承接同一回合只计一次。'
  },
  {
    id: 'question',
    title: '提问',
    detail:
      '按分句检查问号、句末吗/嘛或明确征询词，排除反问；礼貌性道谢不屏蔽其他分句中的实际问题；“没有没有”和询问第三人的句子不算对你的提问。'
  },
  {
    id: 'sharing',
    title: '自我分享与感受',
    detail:
      '第一人称经历、想法与兴趣计为分享；第一人称的实际感受（开心、难过、紧张等）另计为感受分享。引用、要求对方执行的句子和假设表达不计入。'
  },
  {
    id: 'positive',
    title: '正向表达',
    detail: '每回合取最强层级：礼貌或表情 1、支持或具体感谢 4、直接亲近 6。无上下文的泛泛赞美不升级为支持性回应。'
  },
  {
    id: 'goodNews',
    title: '好消息情境',
    detail:
      '我方回合含第一人称“我”与好消息词（通过了、拿到、升职、终于等），且对方 24 小时内回应时，记为一次机会；对方回应无摩擦，并且是支持/具体感谢，或在提问、回答、承接时带有正向表达，记为积极建设性回应。'
  },
  {
    id: 'friction',
    title: '摩擦、敷衍与修复',
    detail:
      '指向对方的指责、反讽或赌气计为摩擦；工作、客户、设备等外部压力的抱怨不算双方摩擦。连续 3 个对方回合缺少有效回应才计敷衍；忙碌、睡觉、晚安与正常收尾不计。解释、和解与常见致歉（对不起、不好意思、我不是那个意思等）计为修复，只会减轻摩擦。'
  },
  {
    id: 'boundary',
    title: '明确边界',
    detail:
      '停止联系、不要打扰等明确措辞（含礼貌请求）计为边界；“不是不喜欢你”等否定拒绝的安抚表达不算拒绝。边界只由规则层识别并触发封顶，AI 单独识别到时只提示人工核对。'
  },
  {
    id: 'excluded',
    title: '不计分的内容',
    detail: '系统消息、非文本媒体记录和纯占位文本不参与评分；回复时延与消息长度只作描述，不进入任何维度。'
  },
  {
    id: 'corrections',
    title: '人工纠正',
    detail:
      '提问、分享、正向、负向、敷衍、低信息量、摩擦、解释、回答或接受建议、承接或补充信息十类识别都可以在「互动评分」中排除或恢复。纠正保存原文快照，原文改变后不沿用旧决定；纠正后各页面的关系指数立即按新结果重算。'
  }
]);

export function createScoringRulesView(React, E) {
  const h = React.createElement;
  const pct = v => Math.round(v * 100) + '%';
  const card = (key, title, ...children) =>
    h('article', { className: 'rn-rule-card', key }, h('h3', null, title), ...children);
  const list = items => h('ul', { className: 'rn-rule-notes' }, ...items.map((text, i) => h('li', { key: i }, text)));
  return function ScoringRulesView({ onRegenerate, onOpenInsight }) {
    const conf = E.LLM_CONFIDENCE;
    const dims = h(
      'table',
      { 'aria-label': '六个维度、权重与规则层公式' },
      h(
        'thead',
        null,
        h('tr', null, ...['维度', '权重', '规则层原始值 x', '定义'].map((label, i) => h('th', { key: i }, label)))
      ),
      h(
        'tbody',
        null,
        ...E.DIMENSIONS.map(d =>
          h(
            'tr',
            { key: d.key },
            h(
              'td',
              null,
              h('strong', null, d.label),
              d.llm ? null : h('div', { className: 'rn-muted' }, '不接受 AI 评分')
            ),
            h('td', { style: { whiteSpace: 'nowrap' } }, pct(d.weight)),
            h('td', { style: { fontSize: 12 } }, d.rule),
            h('td', { style: { fontSize: 12 } }, d.definition)
          )
        )
      )
    );
    return h(
      'section',
      { className: 'rn-box' },
      h('h2', null, '评分规则（关系分析 v3）'),
      h(
        'p',
        { className: 'rn-muted' },
        '关系指数概括可观察的互动过程，不是“对方喜欢你的概率”。每日历程、互动评分、打分依据、月/年图表和关系分析页都使用同一套公式；AI 评定按周缓存，只融合到关系分析页的周指数中。权重与参数是产品设定，未经真实结果校准。'
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0 12px' } },
        onOpenInsight && h('button', { type: 'button', className: 'primary', onClick: onOpenInsight }, '打开关系分析'),
        onRegenerate && h('button', { type: 'button', onClick: onRegenerate }, '重新生成全部每日总结（AI）')
      ),
      h(
        'div',
        { className: 'rn-rules' },
        card(
          'flow',
          '计算流程',
          list([
            '1. 把消息合并为回合，按时段（日、周、月、年或全部记录）汇总双方可观察的互动事实。',
            '2. 规则层计算六个维度的原始值 x（0–1）与证据量 n，以及摩擦强度和边界。',
            '3. 每个维度按证据量向中性值 ' +
              E.PRIOR +
              ' 收缩：d = (n·x + ' +
              E.PRIOR_STRENGTH +
              '·' +
              E.PRIOR +
              ') ÷ (n + ' +
              E.PRIOR_STRENGTH +
              ')，标准误 √(d(1−d)/(n+' +
              E.PRIOR_STRENGTH +
              '))。',
            '4. 综合指数 = 100 × Σ 权重 × d × (1 − 0.6 × 摩擦)；时段内出现明确边界时指数与区间都不超过 ' +
              E.BOUNDARY_CAP +
              '。',
            '5. 对方在该时段没有任何回合时不评分（显示“未评分”），没有聊天的时段是缺口，都不是 0 分。'
          ])
        ),
        card('dims', '六个维度与权重', dims),
        card(
          'friction',
          E.FRICTION.label,
          h('p', null, E.FRICTION.definition),
          h('p', { style: { fontSize: 13 } }, E.FRICTION.rule),
          list([
            '摩擦的先验为 0：F̂ = 对方回合 × F ÷ (对方回合 + ' + E.PRIOR_STRENGTH + ')。',
            '明确边界：对方回合中未被排除的明确拒绝或停止联系表达，触发封顶 ' + E.BOUNDARY_CAP + '。'
          ])
        ),
        card(
          'index',
          '综合指数、区间与可信度',
          list([
            '80% 区间：100 × clip(P ∓ 1.2816 × SE_P, 0, 1) × (1 − 0.6F)，SE_P = √Σ(权重 × SE)² ÷ Σ权重。',
            '可信度：对方回合 ≥ 20 且回应性证据 ≥ 5 为“高”；对方回合 ≥ 8 为“中”；其余为“低”。',
            '日、月、年和全部记录使用同一公式；月、年把各日信号相加后整体评分（不是日分平均），小样本由收缩自然处理。'
          ])
        ),
        card(
          'ai',
          'AI 上下文评定（关系分析页，按周）',
          list([
            '每周最多 80 条消息、每条最多 300 字；超出时优先保留对方有信号的回合及其前一轮我方消息。',
            '评分 1–5 或证据不足；每个评分必须逐字引用原文，宿主校验不通过则整周拒绝。禁止好感概率、确定性结论和依恋/人格诊断。',
            'AI 评分 r 映射为 a = (r−1)/4，以伪计数 m = ' +
              E.LLM_PSEUDO_COUNT +
              ' × 置信度（低 ' +
              conf.low +
              ' / 中 ' +
              conf.medium +
              ' / 高 ' +
              conf.high +
              '）融合，偏移不超过 ±' +
              E.MAX_SHIFT +
              '；规则与 AI 相差超过 ' +
              E.DISAGREE_AT +
              '（且 n ≥ 3）时提示核对。',
            '摩擦同样融合；AI 判定已修复时摩擦再 × 0.75。AI 不能单独触发边界封顶。'
          ])
        ),
        card(
          'longitudinal',
          '长期变化（关系分析页）',
          list([
            'EWMA 平滑（λ = 0.3）；趋势用最近 ≤ 8 个已评分周的加权最小二乘（权重 1/max(4, SE²)，至少 4 周），区间不跨 0 且 |斜率| ≥ 1 分/周才判上升或下降。',
            '变化点：自启动 CUSUM（k = 0.5，h = 3，σ = max(3, MSSD, 0.5 × 中位 SE)），至少 6 个已评分周；按变化点划分阶段并列出主要变化来自哪些维度。'
          ])
        ),
        h('h3', { key: 'recognition-title' }, '识别规则（规则层的输入）'),
        ...RECOGNITION_RULES.map(rule => card('rec-' + rule.id, rule.title, h('p', null, rule.detail))),
        card(
          'balance',
          '互动均衡分（辅助统计，不进入关系指数）',
          h('code', { className: 'rn-rule-value' }, 'round(100 × (1 − |我方条数 − 对方条数| ÷ 总条数))'),
          h('p', { className: 'rn-muted' }, '只比较双方发言条数是否接近，100 表示条数持平。')
        )
      )
    );
  };
}
