// 统一视觉层（3.4 UI 重整）。
// 追加在 workspace.js 既有样式之后，只做视觉与可用性覆盖，不改布局契约：
// - 所有颜色都从宿主变量（--background / --foreground / --border …）派生，
//   深色宿主下自动成立，不再出现白底聊天区、浅绿色块等硬编码颜色；
// - 统一按钮、标签页、卡片、折叠项、表单与空状态的外观与交互反馈；
// - 保留 44px 命中区与键盘焦点样式。
export const THEME_CSS = `
/* ---------- 设计令牌 ---------- */
.rnw{
 --rn-bg:var(--background,#fff);
 --rn-fg:var(--foreground,#1f2421);
 --rn-line:var(--border,#e3e7e4);
 --rn-sub:var(--muted-foreground,#6b756e);
 --rn-brand:#2f7d52;
 --rn-brand-fg:#fff;
 --rn-brand-soft:color-mix(in srgb,var(--rn-brand) 11%,var(--rn-bg));
 --rn-brand-line:color-mix(in srgb,var(--rn-brand) 30%,var(--rn-bg));
 --rn-brand-text:color-mix(in srgb,var(--rn-brand) 78%,var(--rn-fg));
 --rn-surface:color-mix(in srgb,var(--rn-fg) 2.5%,var(--rn-bg));
 --rn-surface-2:color-mix(in srgb,var(--rn-fg) 5.5%,var(--rn-bg));
 --rn-hover:color-mix(in srgb,var(--rn-fg) 6%,transparent);
 --rn-danger:#c0453f;
 --rn-danger-soft:color-mix(in srgb,#c0453f 10%,var(--rn-bg));
 --rn-r:12px;--rn-r-sm:9px;
 --rn-shadow:0 1px 2px color-mix(in srgb,#000 5%,transparent),0 2px 10px color-mix(in srgb,#000 4%,transparent);
 --rn-shadow-pop:0 10px 30px color-mix(in srgb,#000 16%,transparent),0 2px 6px color-mix(in srgb,#000 8%,transparent);
 --rn-ease:cubic-bezier(.2,.7,.2,1);
 color:var(--rn-fg);background:var(--rn-bg);
 -webkit-font-smoothing:antialiased;
 padding-left:clamp(14px,2.4vw,28px)!important;padding-right:clamp(14px,2.4vw,28px)!important;
}
.rnw ::selection{background:color-mix(in srgb,var(--rn-brand) 24%,transparent)}
.rnw #rn-panel{max-width:1440px!important;outline:none}
.rnw .rn-muted{color:var(--rn-sub);line-height:1.6}

/* ---------- 顶栏 ---------- */
.rnw .rn-head{position:sticky;top:-8px;z-index:40;margin:0 calc(-1 * clamp(14px,2.4vw,28px)) 0!important;padding:10px clamp(14px,2.4vw,28px) 8px;background:color-mix(in srgb,var(--rn-bg) 88%,transparent);backdrop-filter:saturate(1.4) blur(10px);-webkit-backdrop-filter:saturate(1.4) blur(10px);align-items:center!important}
.rnw .rn-head h1{font-size:22px!important;letter-spacing:-.3px}
.rnw .rn-head-sub{margin:2px 0 0;font-size:12px;color:var(--rn-sub);display:flex;flex-wrap:wrap;gap:4px 10px}
.rnw .rn-head-sub span+span::before{content:"·";margin-right:10px;opacity:.6}
.rnw .rn-head label{color:var(--rn-sub)}
.rnw .rn-head label select{font-weight:600;color:var(--rn-fg);border-radius:999px!important;padding-left:14px!important;background-color:var(--rn-surface)!important}

/* ---------- 一级导航：分段胶囊 ---------- */
.rnw .rn-tabs.rn-group-tabs{display:inline-flex;gap:4px!important;padding:4px;margin:6px 0 4px!important;border:1px solid var(--rn-line);border-bottom:1px solid var(--rn-line)!important;border-radius:14px;background:var(--rn-surface);max-width:100%}
.rnw .rn-group-tabs button{min-width:72px;justify-content:center;padding:6px 16px!important;border:0!important;border-radius:10px!important;color:var(--rn-sub);font-weight:500;transition:background .15s var(--rn-ease),color .15s}
.rnw .rn-group-tabs button:hover{background:var(--rn-hover)!important;color:var(--rn-fg)}
.rnw .rn-group-tabs button[aria-selected=true]{background:var(--rn-bg)!important;color:var(--rn-fg);font-weight:650;box-shadow:var(--rn-shadow);border-bottom:0!important}

/* ---------- 二级导航：下划线标签 ---------- */
.rnw .rn-tabs.rn-context-tabs{gap:4px!important;margin-top:8px!important;margin-bottom:18px!important;scrollbar-width:none}
.rnw .rn-tabs.rn-context-tabs::-webkit-scrollbar{display:none}
.rnw .rn-context-tabs button{border-color:transparent!important;border-bottom-width:2px!important;padding:10px 12px 11px!important;border-radius:8px 8px 0 0!important;color:var(--rn-sub);transition:color .15s,background .15s}
.rnw .rn-context-tabs button:hover{background:var(--rn-hover)!important;color:var(--rn-fg)}
.rnw .rn-context-tabs button[aria-selected=true]{border-bottom-color:var(--rn-brand)!important;color:var(--rn-fg);background:transparent!important;font-weight:650}

/* ---------- 按钮 ---------- */
.rnw button{border-radius:var(--rn-r-sm);border-color:var(--rn-line);font-weight:500;gap:6px;transition:background .15s var(--rn-ease),border-color .15s,color .15s,box-shadow .15s,transform .08s}
.rnw button:not(:disabled):hover{background:var(--rn-hover);border-color:color-mix(in srgb,var(--rn-fg) 18%,var(--rn-line))}
.rnw button:not(:disabled):active{transform:translateY(1px)}
.rnw button.primary{background:var(--rn-brand)!important;color:var(--rn-brand-fg)!important;border-color:transparent!important;box-shadow:0 1px 2px color-mix(in srgb,var(--rn-brand) 35%,transparent)}
.rnw button.primary:not(:disabled):hover{background:color-mix(in srgb,var(--rn-brand) 88%,#000)!important}
.rnw button:disabled{opacity:.5;cursor:not-allowed}
.rnw button.primary:disabled{background:color-mix(in srgb,var(--rn-brand) 45%,var(--rn-bg))!important;opacity:1;box-shadow:none}
.rnw button[aria-pressed=true]:not(.primary):not(.rn-day){background:var(--rn-brand-soft);border-color:var(--rn-brand-line);color:var(--rn-brand-text);font-weight:600}
.rnw :focus-visible{outline:2px solid color-mix(in srgb,var(--rn-brand) 70%,var(--ring,#6b83ac))!important;outline-offset:2px}

/* ---------- 表单 ---------- */
.rnw input:not([type=checkbox]):not([type=file]):not([type=radio]),.rnw select,.rnw textarea{border-color:var(--rn-line)!important;border-radius:var(--rn-r-sm)!important;background-color:var(--rn-bg);transition:border-color .15s,box-shadow .15s}
.rnw input:not([type=checkbox]):not([type=file]):not([type=radio]):hover,.rnw select:hover,.rnw textarea:hover{border-color:color-mix(in srgb,var(--rn-fg) 22%,var(--rn-line))!important}
.rnw input:not([type=checkbox]):not([type=file]):not([type=radio]):focus,.rnw select:focus,.rnw textarea:focus{outline:none;border-color:var(--rn-brand)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--rn-brand) 18%,transparent)}
.rnw ::placeholder{color:color-mix(in srgb,var(--rn-sub) 80%,transparent)}
.rnw label{font-size:12px;font-weight:500;color:var(--rn-sub)}
.rnw label>select,.rnw label>input,.rnw label>textarea{font-weight:400;color:var(--rn-fg)}
.rnw input[type=checkbox],.rnw input[type=radio]{accent-color:var(--rn-brand);width:16px;height:16px}
.rnw .rn-check{color:var(--rn-fg);font-size:var(--rn-font,13px);font-weight:400}

/* ---------- 卡片与分区 ---------- */
.rnw .rn-box{border-color:var(--rn-line);border-radius:16px;background:var(--rn-bg);box-shadow:var(--rn-shadow);padding:clamp(16px,2vw,24px)}
.rnw .rn-box+.rn-box,.rnw .rn-box+section,.rnw section+.rn-box{margin-top:16px}
.rnw .rn-box>h2{font-size:16px;font-weight:650;letter-spacing:-.1px;display:flex;align-items:center;gap:8px}
.rnw .rn-box>h2::before{content:"";width:4px;height:16px;border-radius:2px;background:var(--rn-brand);flex:none}
.rnw .rn-split{gap:18px}

/* ---------- 指标块 ---------- */
.rnw .rn-metrics{gap:10px;border:0!important;padding:0!important;background:transparent}
.rnw .rn-metric{flex:1 1 150px;padding:14px 16px!important;border:1px solid var(--rn-line)!important;border-radius:var(--rn-r);background:var(--rn-surface);color:var(--rn-sub);font-size:12px}
.rnw .rn-metric strong{color:var(--rn-fg);font-variant-numeric:tabular-nums;letter-spacing:-.3px}

/* ---------- 折叠项（details） ---------- */
.rnw details>summary{list-style:none;position:relative;padding-left:22px!important;border-radius:8px;transition:color .15s}
.rnw details>summary::-webkit-details-marker{display:none}
.rnw details>summary::before{content:"";position:absolute;left:4px;top:50%;width:7px;height:7px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:translateY(-70%) rotate(-45deg);opacity:.55;transition:transform .18s var(--rn-ease)}
.rnw details[open]>summary::before{transform:translateY(-75%) rotate(45deg)}
.rnw details>summary:hover{color:var(--rn-brand-text)}
.rnw .rn-profile-menu>summary,.rnw .rn-settings-menu>summary{padding-left:0!important}
.rnw .rn-profile-menu>summary::before,.rnw .rn-settings-menu>summary::before{display:none}
.rnw .rn-more{border-color:var(--rn-line);background:var(--rn-bg)}

/* ---------- 弹出菜单 ---------- */
.rnw .rn-settings-menu>summary{background:var(--rn-bg);border-color:var(--rn-line)!important;color:var(--rn-sub);transition:background .15s,color .15s}
.rnw .rn-settings-menu>summary:hover,.rnw .rn-settings-menu[open]>summary{background:var(--rn-hover);color:var(--rn-fg)}
.rnw .rn-settings-menu-items,.rnw .rn-profile-menu-items{border-color:var(--rn-line)!important;box-shadow:var(--rn-shadow-pop)!important;animation:rn-pop .14s var(--rn-ease)}
.rnw .rn-settings-menu-items button,.rnw .rn-profile-menu-items button{border:0!important;justify-content:flex-start}
.rnw .rn-profile-menu>summary{color:var(--rn-sub)!important}
.rnw .rn-profile-menu>summary:hover{background:var(--rn-hover)!important}
@keyframes rn-pop{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}

/* ---------- 来源筛选（全部 / 微信 / QQ） ---------- */
.rnw .rn-source-filter{display:inline-flex!important;gap:2px!important;padding:3px;margin:0 0 16px!important;border:1px solid var(--rn-line);border-radius:12px;background:var(--rn-surface)}
.rnw .rn-source-filter button{border:0!important;border-radius:9px!important;padding:6px 14px!important;background:transparent!important;color:var(--rn-sub)!important;box-shadow:none!important;font-weight:500}
.rnw .rn-source-filter button[aria-pressed=true]{background:var(--rn-bg)!important;color:var(--rn-fg)!important;font-weight:650;box-shadow:var(--rn-shadow)!important}

/* ---------- 空状态与引导 ---------- */
.rnw .rn-empty{border-color:var(--rn-line);border-radius:16px;background:var(--rn-surface);padding:40px 24px}
.rnw .rn-empty>h2{font-size:18px;margin-bottom:6px}
.rnw .rn-onboarding-steps{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))!important;gap:12px!important;padding-left:0!important;list-style:none;margin:22px 0 18px!important;counter-reset:rn-step}
.rnw .rn-onboarding-steps>li{counter-increment:rn-step;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:18px;border:1px solid var(--rn-line);border-radius:14px;background:var(--rn-bg);text-align:left}
.rnw .rn-onboarding-steps>li::before{content:counter(rn-step);display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--rn-brand-soft);color:var(--rn-brand-text);font-weight:700;font-size:12px;margin-bottom:6px}
.rnw .rn-onboarding-steps>li>.rn-muted{flex:1;margin:2px 0 10px}
.rnw .rn-upload{border-color:var(--rn-brand-line);border-width:1.5px;border-radius:16px;background:var(--rn-brand-soft);transition:background .15s,border-color .15s}
.rnw .rn-upload.rn-drag{border-color:var(--rn-brand);background:color-mix(in srgb,var(--rn-brand) 18%,var(--rn-bg))}
.rnw .rn-upload>span[aria-hidden]{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:var(--rn-bg);color:var(--rn-brand);box-shadow:var(--rn-shadow)}

/* ---------- 状态提示：底部浮动条 ---------- */
.rnw .rn-toast{position:sticky;bottom:12px;z-index:70;display:flex;align-items:center;gap:10px;width:fit-content;max-width:min(680px,100%);margin:16px auto 0;padding:6px 6px 6px 16px;border:1px solid var(--rn-line);border-radius:14px;background:var(--rn-bg);color:var(--rn-fg);box-shadow:var(--rn-shadow-pop);animation:rn-pop .18s var(--rn-ease)}
.rnw .rn-toast::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--rn-brand);flex:none}
.rnw .rn-toast.rn-toast-error::before{background:var(--rn-danger)}
.rnw .rn-toast>span{flex:1;min-width:0;font-size:13px;line-height:1.5}
.rnw .rn-toast>button{border:0!important;color:var(--rn-sub);font-size:18px;line-height:1;padding:0!important;border-radius:10px!important}
.rnw .rn-error{color:var(--rn-danger)}

/* ---------- 身份确认 ---------- */
.rnw .rn-identity{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:end;gap:12px}
.rnw .rn-identity>button{margin-bottom:0}
@media(max-width:620px){.rnw .rn-identity{grid-template-columns:1fr}.rnw .rn-identity>button{justify-self:start}}

/* ---------- 列表型条目（证据、事实、计划） ---------- */
.rnw .rn-message,.rnw .rn-fact,.rnw .rn-goal{border-bottom-color:var(--rn-line)}
.rnw .rn-message{padding:14px 0}
.rnw .rn-source{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin:6px 0 0}
.rnw .rn-source>button{margin-left:auto;padding:4px 14px!important;font-size:12px;border-radius:999px!important;color:var(--rn-brand-text);border-color:var(--rn-brand-line)!important;background:transparent}
.rnw .rn-source>button:hover{background:var(--rn-brand-soft)!important}
.rnw blockquote{border-left:3px solid var(--rn-brand-line);color:var(--rn-fg);background:var(--rn-surface);padding:8px 12px;border-radius:0 8px 8px 0;margin:8px 0}
.rnw .rn-goal{padding:14px 0}
.rnw pre{background:var(--rn-surface-2)}
.rnw table{border-radius:10px;overflow:hidden}
.rnw th{background:var(--rn-surface)!important;color:var(--rn-sub);font-size:12px;font-weight:600}
.rnw th,.rnw td{border-bottom-color:var(--rn-line)!important}
.rnw tbody tr:hover td{background:var(--rn-surface)}

/* ---------- 档案卡 ---------- */
.rnw .rn-profile-filters{display:inline-flex;gap:2px;padding:3px;border:1px solid var(--rn-line);border-radius:12px;background:var(--rn-surface)}
.rnw .rn-profile-filters button{color:var(--rn-sub)!important;border-radius:9px!important}
.rnw .rn-profile-filters button[aria-pressed=true]{background:var(--rn-bg)!important;color:var(--rn-fg)!important;border-radius:9px!important;box-shadow:var(--rn-shadow);border:0}
.rnw .rn-profile-card{border-color:var(--rn-line)!important;transition:border-color .15s,box-shadow .15s}
.rnw .rn-profile-card:hover{border-color:var(--rn-brand-line)!important;box-shadow:var(--rn-shadow)}
.rnw .rn-profile-evidence,.rnw .rn-profile-card-head>small,.rnw .rn-profile-date{color:var(--rn-sub)!important}
.rnw .rn-profile-comparison{background:var(--rn-surface)!important}
.rnw .rn-profile-undo{background:var(--rn-brand-soft)!important;color:var(--rn-brand-text)}

/* ---------- 日历与图表 ---------- */
.rnw .rn-calendar-wrap,.rnw .rn-annual-card,.rnw .rn-annual-data,.rnw .rn-rule-card{border-color:var(--rn-line)!important;border-radius:14px}
.rnw .rn-calendar-weekday,.rnw .rn-calendar-cell{border-color:var(--rn-line)!important}
.rnw .rn-calendar-cell.empty{background:var(--rn-surface)}
.rnw .rn-day{transition:background .15s,border-color .15s}
.rnw .rn-day:hover{border-color:var(--rn-brand-line)!important}
.rnw .rn-day[aria-pressed="true"]{border-color:var(--rn-brand)!important;box-shadow:inset 0 0 0 1px var(--rn-brand)}
.rnw .rn-day-affinity,.rnw .rn-rule-value,.rnw .rn-rule-formula li b{color:var(--rn-brand-text)!important}
.rnw .rn-rule-value{background:var(--rn-surface-2)!important}
.rnw .rn-rule-formula li{border-left-color:var(--rn-brand-line)!important}
.rnw .rn-metric-scale{border-left-color:var(--rn-brand-line)!important}
.rnw .rn-day-gap{border-color:var(--rn-line)!important}
.rnw .rn-annual-granularity{border-color:var(--rn-line)!important;background:var(--rn-surface);border-radius:11px!important}
.rnw .rn-annual-granularity button{border:0!important;border-radius:8px!important;min-width:40px;justify-content:center}
.rnw .rn-annual-granularity button[aria-pressed=true]{background:var(--rn-bg)!important;color:var(--rn-fg)!important;box-shadow:var(--rn-shadow);border:0}
.rnw .rn-annual-trend .rn-annual-chart text{font-size:15px!important}
.rnw .rn-annual-chart line{stroke:var(--rn-line)}
.rnw .rn-annual-pie-row{background:var(--rn-surface)!important}
.rnw .rn-progress-track{background:var(--rn-surface-2)!important}
.rnw .rn-progress-fill{background:var(--rn-brand)!important}
.rnw .rn-progress-value,.rnw .rn-channel-block h4{color:var(--rn-sub)!important}

/* ---------- 会话：去掉硬编码浅色，深色宿主可用 ---------- */
.rnw .rn-session-pane{border-color:var(--rn-line)!important;background:var(--rn-bg)!important;box-shadow:var(--rn-shadow)}
.rnw .rn-session-list h3,.rnw .rn-session-contact-copy small,.rnw .rn-session-heading small,.rnw .rn-session-message-meta,.rnw .rn-session-compose-tools label,.rnw .rn-session-status,.rnw .rn-session-stat small,.rnw .rn-session-photo-empty{color:var(--rn-sub)!important}
.rnw .rn-session-contact{background:var(--rn-brand-soft)!important;border-radius:10px!important}
.rnw .rn-session-links button{border-radius:8px!important}
.rnw .rn-session-avatar{background:var(--rn-brand-soft)!important;color:var(--rn-brand-text)!important;box-shadow:0 0 0 2px var(--rn-bg)}
.rnw .rn-session-header{gap:8px!important}
.rnw .rn-session-header>button:nth-of-type(2){margin-left:-18px}
.rnw .rn-session-header>button:nth-of-type(2) .rn-session-avatar{width:26px;height:26px;flex-basis:26px;font-size:11px;align-self:flex-end;margin-top:14px}
.rnw .rn-session-header>button:nth-of-type(-n+2){background:transparent!important;min-width:0!important}
.rnw .rn-session-heading strong{font-size:15px!important}
.rnw .rn-session-history{background:var(--rn-surface)!important;border:1px solid var(--rn-line)}
.rnw .rn-session-day{background:var(--rn-surface-2)!important;color:var(--rn-sub)!important;font-variant-numeric:tabular-nums}
.rnw .rn-session-bubble{background:var(--rn-bg)!important;border-color:var(--rn-line)!important;box-shadow:0 1px 1px color-mix(in srgb,#000 4%,transparent)}
.rnw .rn-session-message.self .rn-session-bubble{background:color-mix(in srgb,var(--rn-brand) 20%,var(--rn-bg))!important;border-color:color-mix(in srgb,var(--rn-brand) 30%,var(--rn-bg))!important}
.rnw .rn-media-placeholder,.rnw .rn-session-message.self .rn-media-placeholder{background:var(--rn-surface-2)!important;color:var(--rn-sub)!important}
.rnw .rn-session-media{background:var(--rn-surface-2)!important}
.rnw .rn-session-draft{border-color:var(--rn-brand-line)!important;background:var(--rn-bg)!important}
.rnw .rn-session-draft>strong{display:inline-flex;align-items:center;gap:6px;color:var(--rn-brand-text)!important}
.rnw .rn-session-draft>strong::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--rn-brand)}
.rnw .rn-session-photo{background:var(--rn-surface)!important;border:1px dashed var(--rn-line)}
.rnw .rn-session-stat{background:var(--rn-surface)!important}
.rnw .rn-session-details,.rnw .rn-session-exchange{border-top-color:var(--rn-line)!important}
.rnw .rn-history-toolbar{margin:2px 0}
.rnw .rn-history-toolbar label{color:var(--rn-sub)}
.rnw .rn-kbd-hint{font-size:11px;color:var(--rn-sub);margin-left:auto;white-space:nowrap}

/* ---------- 预览聊天、交流记录 ---------- */
.rnw .rn-chat-preview{background:var(--rn-surface)!important;border-color:var(--rn-line)!important}
.rnw .rn-chat-title{border-bottom-color:var(--rn-line)!important}
.rnw .rn-chat-avatar{background:var(--rn-surface-2)!important;color:var(--rn-sub)!important}
.rnw .rn-chat-row.outgoing .rn-chat-avatar{background:var(--rn-brand-soft)!important;color:var(--rn-brand-text)!important}
.rnw .rn-chat-bubble{background:var(--rn-bg)!important;border-color:var(--rn-line)!important}
.rnw .rn-chat-row.outgoing .rn-chat-bubble{background:color-mix(in srgb,var(--rn-brand) 20%,var(--rn-bg))!important;border-color:color-mix(in srgb,var(--rn-brand) 30%,var(--rn-bg))!important}
.rnw .rn-exchange{border-color:var(--rn-line)!important;background:var(--rn-brand-soft)!important}
.rnw .rn-preview-sections>section,.rnw .rn-media-card{border-color:var(--rn-line)!important}

/* ---------- 行动计划表单 ---------- */
.rnw .rn-goal-form{grid-template-columns:repeat(2,minmax(0,1fr));align-items:end;padding:16px;border:1px solid var(--rn-line);border-radius:14px;background:var(--rn-surface);margin-bottom:12px}
.rnw .rn-goal-form>:first-child{grid-column:1/-1}
.rnw .rn-goal-form>button{grid-column:1/-1;justify-self:start;min-width:120px;justify-content:center}
@media(max-width:620px){.rnw .rn-goal-form{grid-template-columns:1fr}}

/* ---------- 证据浮层 ---------- */
.rn-evidence-overlay{backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:rn-fade .15s ease}
.rn-evidence-overlay>[role=dialog]{box-shadow:var(--rn-shadow-pop);border:1px solid var(--border,#e3e7e4);animation:rn-pop .18s cubic-bezier(.2,.7,.2,1)}
@keyframes rn-fade{from{opacity:0}to{opacity:1}}

/* ---------- 滚动条 ---------- */
.rnw *{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--rn-fg) 18%,transparent) transparent}
.rnw ::-webkit-scrollbar{width:10px;height:10px}
.rnw ::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--rn-fg) 16%,transparent);border-radius:10px;border:3px solid transparent;background-clip:content-box}

@media (prefers-reduced-motion:reduce){.rnw *,.rn-evidence-overlay,.rn-evidence-overlay *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media(max-width:620px){.rnw .rn-head{flex-wrap:wrap;row-gap:8px!important}.rnw .rn-head>div:first-child{flex:1 1 100%}.rnw .rn-head>div:last-child{margin-left:auto}.rnw .rn-group-tabs button{min-width:0;padding:6px 12px!important}.rnw .rn-head h1{font-size:19px!important}.rnw .rn-head label>span,.rnw .rn-head label{font-size:0}.rnw .rn-head label select{font-size:13px;width:128px!important}}
`;
// 会话列表抽屉与工具栏收起：类名由 sessionPaneLayout() 按容器宽度给出，断点与上方容器查询一致。
export const SESSION_LAYOUT_CSS = `
.rnw #rn-panel .right-hidden .rn-session{grid-template-columns:160px minmax(0,1fr)!important;grid-template-areas:"list main"!important}
.rnw #rn-panel .list-hidden.right-hidden .rn-session{grid-template-columns:minmax(0,1fr)!important;grid-template-areas:"main"!important}
.rnw #rn-panel .right-hidden .rn-session-right{display:none!important}
.rnw .rn-session-scrim{display:none}
@container rn-session-shell (max-width:900px){
 .rnw #rn-panel .right-hidden .rn-session{grid-template-columns:minmax(0,1fr)!important;grid-template-areas:"main"!important}
 .rnw #rn-panel .list-open .rn-session-list-pane{display:block!important;position:absolute;left:0;top:0;bottom:0;width:min(260px,82%);z-index:32;overflow:auto;box-shadow:var(--rn-shadow-pop);animation:rn-drawer .18s var(--rn-ease)}
 .rnw #rn-panel .list-open .rn-session-scrim{display:block;position:absolute;inset:0;z-index:31;border-radius:14px;background:color-mix(in srgb,#000 22%,transparent);animation:rn-fade .15s ease}
}
@keyframes rn-drawer{from{transform:translateX(-12px);opacity:0}to{transform:none;opacity:1}}
`;
// 关系分析（v3）页面。三类内容用不同颜色标签区分：原文事实 / AI 引用 / AI 推断。
export const INSIGHT_CSS = `
.rnw .rn-insight{display:grid;gap:16px}
.rnw .rn-insight .rn-box{margin:0!important}
.rnw .rn-tag{display:inline-flex;align-items:center;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:650;line-height:1.7;white-space:nowrap;vertical-align:middle}
.rnw .rn-tag-fact{background:var(--rn-surface-2);color:var(--rn-fg);border:1px solid var(--rn-line)}
.rnw .rn-tag-ai{background:color-mix(in srgb,#3b6fd8 14%,var(--rn-bg));color:color-mix(in srgb,#3b6fd8 80%,var(--rn-fg))}
.rnw .rn-tag-inference{background:color-mix(in srgb,#b7791f 16%,var(--rn-bg));color:color-mix(in srgb,#b7791f 85%,var(--rn-fg))}
.rnw .rn-insight-alert{padding:14px 16px;border-radius:14px;border:1px solid color-mix(in srgb,var(--rn-danger) 40%,var(--rn-bg));background:var(--rn-danger-soft)}
.rnw .rn-insight-alert.soft{border-color:color-mix(in srgb,#b7791f 40%,var(--rn-bg));background:color-mix(in srgb,#b7791f 10%,var(--rn-bg))}
.rnw .rn-insight-alert p{margin:4px 0 0}
.rnw .rn-insight-hero-main{display:grid;grid-template-columns:minmax(200px,1fr) minmax(0,1.6fr);gap:20px;align-items:start}
.rnw .rn-insight-score{display:flex;align-items:baseline;gap:6px;margin:4px 0}
.rnw .rn-insight-score strong{font-size:48px;line-height:1;font-weight:700;letter-spacing:-1.5px;font-variant-numeric:tabular-nums;color:var(--rn-brand-text)}
.rnw .rn-insight-score span{color:var(--rn-sub)}
.rnw .rn-insight-facts{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.rnw .rn-insight-facts li{display:grid;gap:2px;padding:12px 14px;border:1px solid var(--rn-line);border-radius:12px;background:var(--rn-surface)}
.rnw .rn-insight-facts li>span{font-size:12px;color:var(--rn-sub)}
.rnw .rn-insight-facts li>strong{font-size:17px}
.rnw .rn-insight-facts li>small{color:var(--rn-sub);font-size:11.5px;line-height:1.5}
.rnw .rn-tone-up{color:var(--rn-brand-text)!important}
.rnw .rn-tone-down{color:var(--rn-danger)!important}
.rnw .rn-tone-flat{color:var(--rn-fg)}
.rnw .rn-insight-actions{display:grid;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--rn-line)}
.rnw .rn-insight-actions>button{justify-self:start}
.rnw .rn-insight-progress{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.rnw .rn-insight-legend{margin:0;font-size:12px;color:var(--rn-sub);line-height:2}
.rnw .rn-insight-disclaimer{margin:10px 0 0;font-size:12px;color:var(--rn-sub)}
.rnw .rn-insight-chart{display:block;width:100%;height:auto;max-height:280px}
.rnw .rn-insight-grid{stroke:var(--rn-line);stroke-width:1}
.rnw .rn-insight-axis{fill:var(--rn-sub);font-size:11px;font-family:inherit}
.rnw .rn-insight-band{fill:color-mix(in srgb,var(--rn-brand) 14%,transparent)}
.rnw .rn-insight-line{fill:none;stroke:var(--rn-brand);stroke-width:2}
.rnw .rn-insight-ewma{fill:none;stroke:var(--rn-fg);stroke-width:1.5;stroke-dasharray:5 4;opacity:.55}
.rnw .rn-insight-cp{stroke:#b7791f;stroke-width:1.5;stroke-dasharray:3 3}
.rnw .rn-insight-dot{fill:var(--rn-bg);stroke:var(--rn-brand);stroke-width:2;cursor:pointer}
.rnw .rn-insight-dot.selected{fill:var(--rn-brand)}
.rnw .rn-insight-dot:focus-visible{outline:none;stroke-width:4}
.rnw .rn-insight-gap{fill:none;stroke:var(--rn-sub);stroke-dasharray:2 2}
.rnw .rn-insight-chart-legend{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;margin:6px 0 0;font-size:12px;color:var(--rn-sub)}
.rnw .rn-insight-chart-legend .sw{display:inline-block;width:16px;height:3px;border-radius:2px;margin-left:6px}
.rnw .sw.line{background:var(--rn-brand)}.rnw .sw.band{height:10px;background:color-mix(in srgb,var(--rn-brand) 18%,transparent)}.rnw .sw.ewma{background:repeating-linear-gradient(90deg,var(--rn-fg) 0 4px,transparent 4px 7px);opacity:.6}.rnw .sw.cp{width:3px;height:12px;background:#b7791f}.rnw .sw.gap{width:7px;height:7px;border:1px dashed var(--rn-sub);border-radius:50%}
.rnw .rn-insight-phases{display:grid;gap:8px;margin:14px 0 0;padding-left:20px}
.rnw .rn-insight-phases li>div{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
.rnw .rn-insight-phases small{color:var(--rn-sub)}
.rnw .rn-insight-phases p{margin:2px 0 0;font-size:12.5px}
.rnw .rn-insight-week-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;margin:-4px 0 12px;font-size:12.5px;color:var(--rn-sub)}
.rnw .rn-insight-week-pick{flex-direction:row!important;align-items:center;margin-left:auto}
.rnw .rn-insight-week-pick select{width:auto;min-width:170px}
.rnw .rn-insight-summary{padding:12px 14px;margin-bottom:12px;border-radius:12px;background:color-mix(in srgb,#3b6fd8 6%,var(--rn-bg));border:1px solid color-mix(in srgb,#3b6fd8 18%,var(--rn-bg))}
.rnw .rn-insight-summary p{margin:6px 0 0}
.rnw .rn-insight-dims{display:grid;gap:8px}
.rnw .rn-insight-dim{border:1px solid var(--rn-line);border-radius:12px;background:var(--rn-bg);overflow:hidden}
.rnw .rn-insight-dim.open{border-color:var(--rn-brand-line)}
.rnw .rn-insight-dim-head{display:grid!important;grid-template-columns:96px minmax(80px,1fr) 40px 250px;align-items:center;gap:6px 14px;width:100%;padding:10px 14px!important;border:0!important;border-radius:0!important;text-align:left;background:transparent}
.rnw .rn-insight-dim-name{font-weight:650}
.rnw .rn-insight-dim-val{font-weight:700;font-variant-numeric:tabular-nums;text-align:right}
.rnw .rn-insight-dim-meta{font-size:11.5px;color:var(--rn-sub);white-space:nowrap;text-align:right;overflow:hidden;text-overflow:ellipsis}
.rnw .rn-insight-flag{grid-column:1/-1;justify-self:start;font-size:11.5px;padding:1px 8px;border-radius:999px;background:color-mix(in srgb,#b7791f 14%,var(--rn-bg));color:color-mix(in srgb,#b7791f 85%,var(--rn-fg))}
.rnw .rn-insight-bar{position:relative;height:8px;border-radius:99px;background:var(--rn-surface-2)}
.rnw .rn-insight-bar>i{position:absolute;inset:0 auto 0 0;border-radius:99px;background:var(--rn-brand)}
.rnw .rn-insight-bar.friction>i{background:var(--rn-danger)}
.rnw .rn-insight-tick{position:absolute;top:-4px;width:2px;height:16px;border-radius:1px;transform:translateX(-1px)}
.rnw .rn-insight-tick.rule{background:var(--rn-fg);opacity:.55}
.rnw .rn-insight-tick.ai{background:#3b6fd8}
.rnw .rn-insight-dim-body{padding:4px 14px 14px;border-top:1px solid var(--rn-line)}
.rnw .rn-insight-method{margin:6px 0 10px;font-size:12.5px}
.rnw .rn-insight-refs{margin:6px 0 0;padding-left:18px;font-size:12px;color:var(--rn-sub)}
.rnw .rn-insight-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.rnw .rn-insight-columns h4{display:flex;align-items:center;gap:6px;margin:6px 0 8px;font-size:12.5px}
.rnw .rn-insight-quotes{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.rnw .rn-insight-quote{padding:10px 12px;border:1px solid var(--rn-line);border-radius:10px;background:var(--rn-surface)}
.rnw .rn-insight-quote-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px}
.rnw .rn-insight-quote-head small{color:var(--rn-sub)}
.rnw .rn-insight-quote blockquote{margin:6px 0}
.rnw .rn-insight-note,.rnw .rn-insight-count{margin:4px 0;font-size:12.5px}
.rnw .rn-insight-open{font-size:12px;padding:2px 12px!important;border-radius:999px!important;color:var(--rn-brand-text);border-color:var(--rn-brand-line)!important;background:transparent}
.rnw .rn-insight-inference{margin-top:10px;padding:10px 12px;border-radius:10px;border:1px dashed color-mix(in srgb,#b7791f 45%,var(--rn-bg));background:color-mix(in srgb,#b7791f 7%,var(--rn-bg))}
.rnw .rn-insight-inference>div{display:flex;align-items:center;gap:8px}
.rnw .rn-insight-inference small{color:var(--rn-sub)}
.rnw .rn-insight-inference p{margin:6px 0 0}
.rnw .rn-insight-alt{font-size:12.5px;color:var(--rn-sub)}
.rnw .rn-insight-boundary{margin-top:14px}
.rnw .rn-insight-about table{margin:8px 0;font-size:12.5px}
.rnw .rn-insight-about li{margin:6px 0;font-size:12.5px;line-height:1.7}
@media(max-width:620px){.rnw .rn-insight-axis{font-size:20px}.rnw .rn-insight-chart{max-height:none}}
@media(max-width:760px){.rnw .rn-insight-hero-main,.rnw .rn-insight-columns{grid-template-columns:1fr}.rnw .rn-insight-dim-head{grid-template-columns:80px minmax(60px,1fr) 34px}.rnw .rn-insight-dim-meta{grid-column:1/-1;white-space:normal;text-align:left}.rnw .rn-insight-week-pick{margin-left:0}.rnw .rn-insight-score strong{font-size:40px}}
`;
