import { boundary, negative } from './interaction-boundary.js';
export { boundary, negative } from './interaction-boundary.js';
import { shanghaiTimestamp, shanghaiDateKey } from './shared/dates.js';
import { scoringMessage, sceneGroups, replyContext, directedRequest } from './interaction-context.js';
// One conservative signal vocabulary for daily and overall views.
// 「?」不等于提问：反问、道谢、赌气都带问号，先排除这些句式再判。
const RHETORICAL =
  /(?:谢谢你|谢了|就这|讲啥道理|讲道理|难道|难不成|你以为|谁不知道|还用说|凭什么|有什么好|何必|岂不是|可不是|至于吗|行了吧|算了|呵呵|随便你)/;
// 只有「等一个答复」才算提问：句末问号、句末「吗」，或明确的征询说法。
// 「啥／咋／几天」这类词在陈述句里到处都是（咋过这么快、我啥时候出去玩了、干几天走了），不能当提问。
const ASK_STRONG =
  /(?:干嘛|干啥|干什么|做什么|去哪儿|去哪里|在哪儿|在哪里|几点|多少钱|多少个?人|为什么|为啥|要不要|能不能|可不可以|会不会|是不是|对不对|好不好|有没有|行不行|在不在|有空吗|可以吗|咋了|怎么了|咋回事|怎么办|怎么样)/;
function stripTail(text) {
  let value = String(text);
  for (let i = 0; i < 3; i += 1) {
    const next = value.replace(/[\s。！!…~～，,]+$/, '').replace(/(?:\[[^\[\]]{1,12}\]|【[^【】]{1,12}】)$/, '');
    if (next === value) break;
    value = next;
  }
  return value;
}
export const question = text => {
  text = directText(text);
  if (!text) return false;
  const clauses = (text.match(/[^，,。！!；;\n?？]+[?？]?/g) || []).map(part =>
    part.replace(/^(?:谢谢你|谢了)[呀啊啦哦~～\s]*/, '')
  );
  return clauses.some(clause => {
    if (!clause.replace(/[?？\s]/g, '') || RHETORICAL.test(clause) || boundary(clause)) return false;
    const body = stripTail(clause);
    if (/^(?:没有)+[。！!\s]*$/.test(body) || /(?:问问|问一下|替我问|帮我问)/.test(body)) return false;
    if (/[?？]/.test(clause)) return true;
    if (/(?:吗|嘛)$/.test(body)) return true;
    if (/(?:不|没)(?:怎么样|如何)$/.test(body)) return false;
    return ASK_STRONG.test(body);
  });
};
export function emotionalSharing(text) {
  return directText(text)
    .split(/[。！？!?，,\n]/)
    .some(part => {
      if (question(part) || directedRequest(part) || /如果|假如|要是|假设/.test(part)) return false;
      return /^\s*我(?:(?:最近|今天|昨天|现在|其实|真的|一直|有点|有些|很|特别|非常|感到|觉得|挺|也|还|不太|并不|不怎么|没有那么))*?(?:开心|难过|紧张|害怕|担心|失落|委屈|幸福|安心|焦虑|孤独|伤心|兴奋|沮丧|压力很大)/.test(
        part
      );
    });
}
export function sharing(text) {
  const direct = directText(text);
  return (
    emotionalSharing(direct) ||
    direct.split(/[。！？!?，,\n]/).some(text => {
      text = text.trim();
      if (question(text) || directedRequest(text) || /如果|假如|要是|假设/.test(text)) return false;
      return (
        /(?:^|[。！？!?，,\n])\s*我(?:俩|们|已经|最近|今天|昨天|老|就|还|也|只|突然|都|自己|好久|一直|现在|以前|以前在|在学校的时候)*(?:吃|喝|买|看|去|想|记得|忘了|累|饿|减肥|忍住|休息|没有吃)/.test(
          text
        ) ||
        /(?:^|[。！？!?，,\n])\s*我(?:最近|今天|昨天|刚刚|刚|正在|现在|周末|平时|已经|打算|计划|很|比较|最|一直|在)*(?:喜欢|爱好|偏好|去了|去过|参加|完成|忙着|在|住在|从事|学|买了|看了|吃了|做了|整理|拍了|写了|工作)/.test(
          text
        )
      );
    })
  );
}

export const acknowledgment = text =>
  /^(?:(?:好(?:的|呀|啊)?|嗯+|收到|了解|明白(?:了)?|谢谢|没问题|知道了)[，,。！!\s]*)+$/.test(text.trim());
function directText(text) {
  const value = String(text).replace(/[“「『‘"][^”」』’"]*[”」』’"]/g, '');
  return (value.match(/[^。！？!?；;\n]+[。！？!?；;\n]?/g) || [])
    .filter(part => !/(?:她|他|朋友|同事|对方|有人).*(?:说|表示|告诉)|(?:台词|原话|引用)/.test(part))
    .join('');
}
const positivePatterns = [
  {
    kind: 'affection',
    label: '明确亲近表达',
    weight: 6,
    pattern:
      /(?:喜欢你(?!的|们)|爱你(?!的|们)|想你(?=了|啦|呀|啊|呢|哦|[。！!，,\s]|$)|想见你|期待(?:见你|和你见面)|开心(?:和你|见到你|跟你)|高兴(?:和你|见到你)|(?:愿意|想|会)(?:一直)?陪(?:着)?你)/g
  },
  {
    kind: 'support',
    label: '关心、支持或具体感谢',
    weight: 4,
    pattern:
      /(?:关心你|担心你|心疼你|我(?:能)?理解你(?:的感受|的心情|的难处)|我(?:愿意|可以)听你说|我(?:会|愿意)支持你|(?:为你|替你)(?:开心|高兴)|恭喜你|祝贺你|(?:谢谢|感谢)你(?:一直|这么|那么|愿意|耐心|特意|陪|帮|听|关心|支持)|你(?:真的|真|太|好|很)(?:好|可爱|漂亮|厉害|体贴|温柔))/g
  },
  {
    kind: 'courtesy',
    label: '礼貌或一般积极表达',
    weight: 1,
    pattern: /(?:谢谢(?:你)?|谢了|辛苦(?:你)?了|抱抱|亲亲|❤️|❤|🥰|😍|😘)/g
  }
];
export function positiveSignal(text) {
  let best = { kind: 'none', label: '未识别正向表达', weight: 0 };
  for (const part of directText(text).split(/[。！？!?，,\n]/)) {
    if (
      directedRequest(part) ||
      conflict(part) ||
      /如果|假如|要是|假设/.test(part) ||
      /^\s*(?:他|她|他们|她们|同事|朋友|小猫|小狗)/.test(part)
    )
      continue;
    for (const signal of positivePatterns) {
      for (const match of part.matchAll(new RegExp(signal.pattern.source, 'g'))) {
        const prefix = part.slice(0, match.index);
        if (/(?:不|没|未|别|并非|不是|不用|无需|不必).{0,4}$/.test(prefix)) continue;
        // The sender must express the sentiment, rather than ask whether the addressee does.
        if (/(?:是不是|是否|难道|会不会|你说|你觉得)/.test(prefix)) continue;
        if (signal.weight > best.weight) best = { kind: signal.kind, label: signal.label, weight: signal.weight };
      }
    }
  }
  return best;
}
export const positive = text => positiveSignal(text).weight > 0;

export const interactionDetectors = { question, sharing, positive, boundary: negative };
// 收尾式/敷衍措辞：明确只想结束对话，或只有应和、没有信息量。
const brushOffPattern =
  /^(?:在忙|忙|有点忙|很忙|加班|没空|没时间|回头(?:再)?说|晚点(?:再)?说|再说吧|改天(?:再)?聊|先这样|不聊了|困了|睡了)[。！!，,~～…\s]*$/;
const fillerOnlyPattern =
  /^(?:嗯+|哦+|噢+|喔+|啊+|嗯嗯|哈+|呵+|嘿嘿|好吧|行吧|行|可以|好的|好|收到|了解|明白了|知道了|没事|随你|都行|不知道)[。！!，,~～…\s]*$/;
const emojiOnlyPattern = /^[\p{Extended_Pictographic}\p{Emoji_Component}\uFE0F\u200D\s]+$/u;
const PLACEHOLDER_PATTERN = /^(?:【[^】]{1,8}】|\[[^\]]{1,8}\]|.*\.(?:jpg|jpeg|png|gif|webp|mp4|amr|silk|mp3))$/i;
export function isPlaceholder(text) {
  return PLACEHOLDER_PATTERN.test(
    String(text ?? '')
      .replace(/<[^>]*>/g, '')
      .trim()
  );
}
export function perfunctory(text) {
  const body = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (isPlaceholder(body)) return false;
  if (!body) return true;
  if (question(body) || positive(body)) return false;
  if (brushOffPattern.test(body) || fillerOnlyPattern.test(body)) return true;
  return emojiOnlyPattern.test(body);
}
export function lowContent(text) {
  const body = String(text ?? '').trim();
  if (isPlaceholder(body)) return false;
  if (!body || question(body) || positive(body) || sharing(body)) return false;
  return body.replace(/[。！!，,、~～…？?\s]/g, '').length <= 5;
}
const SESSION_GAP_MINUTES = 120;
const CONFLICT_PATTERN =
  /(?:那我还得|我还得谢谢|行了吧|随便你|都行看你|你看着办|关你什么事|跟你有关系|你什么意思|别说了|算了(?:不说了|别说了)|无语|烦死|想太多|自作多情|说得好像|呵呵|怎么着|你赢了|不想说|懒得说|别问我)/;
const APPEASE_PATTERN =
  /(?:我只是(?:说|讲|着急|觉得|随口)|没啥啊|没别的意思|你别多想|不是那个意思|我说的是(?:工作|事情)|你决定(?:好)?就行|随口一说)/;
/** 反讽、赌气、明确不快的措辞。 */
export function conflict(text) {
  const body = directText(text).replace(/\s+/g, ' ').trim();
  const external = /工作|加班|客户|老板|同事|堵车|天气|考试|作业|系统|电脑|手机|自己/;
  const directed = /你让我|你怎么|你总是|你又|跟你|对你|烦死你|随便你|关你什么事|你什么意思|你看着办|你赢了|别问我/;
  if (external.test(body) && !directed.test(body)) return false;
  return body.split(/[。！？!?，,\n]/).some(part => {
    // 外界压力和对自己失误的抱怨不自动成为双方关系摩擦。
    if (external.test(part) && !directed.test(part)) return false;
    return CONFLICT_PATTERN.test(part);
  });
}
/** 事后解释、退让式收尾——通常出现在一次摩擦之后。 */
export function appeasement(text) {
  const body = directText(text).replace(/\s+/g, ' ').trim();
  return !conflict(body) && APPEASE_PATTERN.test(body);
}
const BURST_GAP_MINUTES = 3;
const toMillis = shanghaiTimestamp;
/** Who opened each conversation block, how fast the other side answered, and how empty those answers were. */
export function engagementSignals(messages, self, isExcluded) {
  const list = Array.isArray(messages) ? messages.filter(scoringMessage) : [];
  const assignments = new WeakMap();
  for (const [scene, rows] of Object.entries(sceneGroups(list))) for (const row of rows) assignments.set(row, scene);
  const turns = [];
  for (const message of list) {
    const at = toMillis(message.timestamp),
      last = turns.at(-1);
    if (
      last &&
      last.sender === message.sender &&
      at !== null &&
      last.at !== null &&
      at >= last.at &&
      at - last.at <= BURST_GAP_MINUTES * 60000 &&
      shanghaiDateKey(message.timestamp) === shanghaiDateKey(last.messages[0].timestamp)
    ) {
      last.messages.push(message);
      last.at = at;
    } else turns.push({ sender: message.sender, at, firstAt: at, messages: [message] });
  }
  let selfStarts = 0,
    targetStarts = 0,
    previousAt = null,
    previousSender = null,
    previousWasSelf = false,
    lastSelfAt = null;
  let perfunctoryReplies = 0,
    lowContentReplies = 0,
    targetTurns = 0,
    selfTurns = 0,
    conflictReplies = 0,
    appeasementReplies = 0;
  let sessionConflicts = 0,
    strongConflict = false,
    previousText = '',
    emptyStreak = 0;
  const scenes = { work: 0, daily: 0, mixed: 0, unknown: 0 };
  const startsByScene = { work: 0, daily: 0, mixed: 0, unknown: 0 };
  let answeredTurns = 0,
    continuedTurns = 0,
    responsiveTurns = 0;
  let positiveTurns = 0,
    questionTurns = 0,
    sharingTurns = 0,
    boundaryTurns = 0,
    positivePoints = 0,
    emotionalSharingTurns = 0;
  const latencies = [],
    turnEvidence = [],
    events = [];
  for (const turn of turns) {
    const before = {
      selfStarts,
      targetStarts,
      perfunctoryReplies,
      lowContentReplies,
      targetTurns,
      selfTurns,
      conflictReplies,
      appeasementReplies,
      answeredTurns,
      continuedTurns,
      responsiveTurns,
      positiveTurns,
      questionTurns,
      sharingTurns,
      boundaryTurns,
      positivePoints,
      emotionalSharingTurns
    };
    const latencyStart = latencies.length;
    let turnStrong = false;
    const excluded = kind => {
      const detectors = { conflict, appeasement, perfunctory, lowContent };
      let relevant = turn.messages;
      if (detectors[kind]) relevant = turn.messages.filter(message => detectors[kind](message.text));
      if (kind === 'answer' || kind === 'continuation')
        relevant = turn.messages.filter(message => {
          const context = replyContext(previousText, message.text, question(previousText));
          return kind === 'answer' ? context.answer || context.affirmative : context.continuation;
        });
      if (!relevant.length) relevant = turn.messages;
      return relevant.every(message => isExcluded?.(message, kind));
    };
    const at = turn.firstAt,
      isTarget = turn.sender !== self;
    const newSession =
      previousSender === null || at === null || previousAt === null || at - previousAt >= SESSION_GAP_MINUTES * 60000;
    if (newSession) {
      if (isTarget) targetStarts++;
      else selfStarts++;
      sessionConflicts = 0;
      emptyStreak = 0;
    }
    if (isTarget) {
      targetTurns++;
      if (previousWasSelf && at !== null && lastSelfAt !== null && at >= lastSelfAt)
        latencies.push((at - lastSelfAt) / 60000);
      const joined = turn.messages
        .map(message => String(message.text ?? '').trim())
        .filter(Boolean)
        .join(' ');
      const message = turn.messages[0];
      const scene = assignments.get(message) || 'unknown';
      scenes[scene]++;
      if (newSession) startsByScene[scene]++;
      const rawContext = replyContext(
        previousWasSelf ? previousText : '',
        joined,
        previousWasSelf && question(previousText)
      );
      const excludeAnswer = excluded('answer'),
        excludeContinuation = excluded('continuation');
      const context = {
        answer: rawContext.answer && !excludeAnswer,
        affirmative: rawContext.affirmative && !excludeAnswer,
        continuation: rawContext.continuation && !excludeContinuation
      };
      if (context.answer || context.affirmative) answeredTurns++;
      if (context.continuation) continuedTurns++;
      // A short delegation after a choice question does not establish hostility.
      const delegatesChoice =
        previousWasSelf &&
        !newSession &&
        /(?:还是|选哪个|选哪家|你选|你决定|哪个好)/.test(previousText) &&
        /^(?:随便你|都行看你|你看着办)[。！!，,\s]*$/.test(joined);
      const needsReview = !delegatesChoice && /^(?:随便你|都行看你|你看着办)[。！!，,\s]*$/.test(joined);
      const detectedConflict = !delegatesChoice && !needsReview && conflict(joined);
      const detectedAppeasement = appeasement(joined);
      const hasSpecificNegative = detectedConflict || detectedAppeasement || negative(joined);
      const laughter = /^(?:哈+|嘿嘿)[。！!\s]*$/.test(joined);
      const ordinaryPause =
        /^(?:我(?:现在)?(?:在|有点)?|今天)?(?:在忙|忙|有点忙|很忙|加班|开会|没空|没时间|困了|睡了|先睡了|准备睡了|要睡了|休息了|晚安|回头再说|晚点再说|先这样|改天再聊|明天聊|晚点聊|回头聊|先忙了|稍后聊|晚点再聊|回头再聊|不聊了|再说吧)[。！!，,~～…\s]*$/.test(
          joined
        );
      const generic = !ordinaryPause && !delegatesChoice && !needsReview && (perfunctory(joined) || lowContent(joined));
      emptyStreak =
        generic && !context.answer && !context.affirmative && !context.continuation && !laughter ? emptyStreak + 1 : 0;
      const detectedPerfunctory =
        !ordinaryPause &&
        !hasSpecificNegative &&
        !laughter &&
        !context.answer &&
        !context.affirmative &&
        emptyStreak >= 3 &&
        perfunctory(joined);
      const detectedLowContent =
        !hasSpecificNegative &&
        !detectedPerfunctory &&
        emptyStreak >= 3 &&
        !context.answer &&
        !context.continuation &&
        lowContent(joined);
      const detected = {
        answer: rawContext.answer || rawContext.affirmative,
        continuation: rawContext.continuation,
        conflict: detectedConflict,
        appeasement: detectedAppeasement,
        perfunctory: detectedPerfunctory,
        lowContent: detectedLowContent
      };
      const kinds = Object.keys(detected).filter(kind => detected[kind]);
      const applied = kinds.filter(kind => !excluded(kind));
      const hasSignal = (kind, detect) =>
        turn.messages.some(message => detect(message.text) && !isExcluded?.(message, kind));
      const hasBoundary = hasSignal('boundary', negative);
      if (hasBoundary) boundaryTurns++;
      const positiveWeight = Math.max(
        0,
        ...turn.messages.map(message => (isExcluded?.(message, 'positive') ? 0 : positiveSignal(message.text).weight))
      );
      if (positiveWeight) {
        positiveTurns++;
        positivePoints += positiveWeight;
      }
      if (hasSignal('question', question)) questionTurns++;
      if (hasSignal('sharing', sharing)) sharingTurns++;
      if (hasSignal('sharing', emotionalSharing)) emotionalSharingTurns++;
      // 同一回合回答并承接只计一次；拒绝和摩擦不再赚取回应奖励。
      if (
        !hasBoundary &&
        !applied.includes('conflict') &&
        (applied.includes('answer') || applied.includes('continuation'))
      )
        responsiveTurns++;
      turnEvidence.push({
        message,
        messages: turn.messages,
        quote: joined,
        kinds,
        applied,
        scene,
        context,
        needsReview
      });
      if (applied.includes('perfunctory')) perfunctoryReplies++;
      if (applied.includes('lowContent')) lowContentReplies++;
      if (applied.includes('conflict')) {
        conflictReplies++;
        sessionConflicts++;
      }
      if (applied.includes('appeasement')) appeasementReplies++;
      if (sessionConflicts >= 2) {
        strongConflict = true;
        turnStrong = true;
      }
    }
    if (isTarget) previousWasSelf = false;
    else {
      selfTurns++;
      lastSelfAt = turn.at;
      previousWasSelf = true;
    }
    const after = {
      selfStarts,
      targetStarts,
      perfunctoryReplies,
      lowContentReplies,
      targetTurns,
      selfTurns,
      conflictReplies,
      appeasementReplies,
      answeredTurns,
      continuedTurns,
      responsiveTurns,
      positiveTurns,
      questionTurns,
      sharingTurns,
      boundaryTurns,
      positivePoints,
      emotionalSharingTurns
    };
    events.push({
      date: shanghaiDateKey(turn.messages[0].timestamp),
      counts: Object.fromEntries(Object.keys(before).map(key => [key, after[key] - before[key]])),
      latencies: latencies.slice(latencyStart),
      strongConflict: turnStrong,
      scene: assignments.get(turn.messages[0]) || 'unknown'
    });
    previousAt = turn.at ?? previousAt;
    previousSender = turn.sender;
    previousText = turn.messages.map(message => String(message.text ?? '')).join(' ');
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const medianMinutes = sorted.length ? Math.round(sorted[Math.floor((sorted.length - 1) / 2)]) : null;
  return {
    selfStarts,
    targetStarts,
    medianMinutes,
    slowReplies: latencies.filter(minutes => minutes >= SESSION_GAP_MINUTES).length,
    perfunctoryReplies,
    lowContentReplies,
    targetTurns,
    conflictReplies,
    appeasementReplies,
    selfTurns,
    replySamples: latencies.length,
    strongConflict,
    turnEvidence,
    scenes,
    startsByScene,
    answeredTurns,
    continuedTurns,
    responsiveTurns,
    positiveTurns,
    questionTurns,
    sharingTurns,
    boundaryTurns,
    positivePoints,
    emotionalSharingTurns,
    events
  };
}
// 旧版“好感线索分 v2.3”的计分函数已移除：评分统一由关系分析 v3（src/affinity/）完成；本文件只负责可核对的信号识别。
export function engagementDays(result) {
  const days = new Map();
  for (const event of result.events) {
    if (!event.date) continue;
    if (!days.has(event.date))
      days.set(event.date, {
        latencies: [],
        strongConflict: false,
        scenes: { work: 0, daily: 0, mixed: 0, unknown: 0 }
      });
    const day = days.get(event.date);
    for (const [key, value] of Object.entries(event.counts)) day[key] = (day[key] || 0) + value;
    day.latencies.push(...event.latencies);
    day.strongConflict ||= event.strongConflict;
    day.scenes[event.scene] += event.counts.targetTurns;
  }
  for (const day of days.values()) {
    const sorted = day.latencies.slice().sort((a, b) => a - b);
    day.medianMinutes = sorted.length ? Math.round(sorted[Math.floor((sorted.length - 1) / 2)]) : null;
    day.slowReplies = sorted.filter(minutes => minutes >= SESSION_GAP_MINUTES).length;
    day.replySamples = sorted.length;
  }
  return days;
}
