// 关系手记 · 视觉系统（v2）
//
// 设计方向：一本安静的“关系手记”。界面本身克制，只在一处用力——页头的“关系脉搏”
// （对方头像、名字、最近 20 周互动指数折线），让每一页都能看到“这段关系现在怎样”。
//
// 色彩（全部与宿主背景/前景混合派生，浅色与深色主题一致）：
//   青瓷 #3E8A7E  主要操作、选中状态、正向数据
//   藕荷 #B95C7E  只用于“关系脉搏”（页头折线、指数数字、趋势线）
//   黛蓝 #4361A8  AI 相关内容
//   琥珀 #B07A22  推断、待核对
//   朱砂 #C0453F  拒绝、摩擦、错误
// 字体：中文用系统黑体；数字用旧式衬线（Palatino / Georgia），带出手记的书写感。
// 层级：特写卡（一页最多一个）> 分区（平面、细边框）> 条目（浅底、无边框）；阴影只给浮层。
export const THEME_CSS = `
/* ---------- 令牌 ---------- */
.rnw{
 --rn-bg:var(--background,#fff);
 --rn-fg:var(--foreground,#1d2321);
 --rn-line:var(--border,#e2e6e4);
 --rn-sub:var(--muted-foreground,#66706b);
 --rn-brand:#3E8A7E;--rn-brand-fg:#fff;
 --rn-pulse:#B95C7E;--rn-ai:#4361A8;--rn-amber:#B07A22;--rn-danger:#C0453F;
 --rn-brand-soft:color-mix(in srgb,var(--rn-brand) 11%,var(--rn-bg));
 --rn-brand-line:color-mix(in srgb,var(--rn-brand) 34%,var(--rn-bg));
 --rn-brand-text:color-mix(in srgb,var(--rn-brand) 82%,var(--rn-fg));
 --rn-pulse-soft:color-mix(in srgb,var(--rn-pulse) 13%,var(--rn-bg));
 --rn-pulse-text:color-mix(in srgb,var(--rn-pulse) 85%,var(--rn-fg));
 --rn-danger-soft:color-mix(in srgb,var(--rn-danger) 10%,var(--rn-bg));
 --rn-surface:color-mix(in srgb,var(--rn-fg) 3.2%,var(--rn-bg));
 --rn-surface-2:color-mix(in srgb,var(--rn-fg) 6.5%,var(--rn-bg));
 --rn-hover:color-mix(in srgb,var(--rn-fg) 6%,transparent);
 --rn-line-soft:color-mix(in srgb,var(--rn-line) 60%,transparent);
 --rn-font-ui:"PingFang SC","HarmonyOS Sans SC","MiSans","Microsoft YaHei UI","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif;
 --rn-font-num:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
 --rn-chart-line:var(--rn-brand);--rn-chart-line-strong:var(--rn-brand-text);--rn-chart-text:var(--rn-brand-text);
 --rn-chart-self:color-mix(in srgb,var(--rn-brand) 72%,var(--rn-bg));--rn-chart-target:color-mix(in srgb,#7F92AE 85%,var(--rn-bg));--rn-chart-target-text:color-mix(in srgb,#5b7285 75%,var(--rn-fg));
 --rn-r-lg:18px;--rn-r:14px;--rn-r-sm:10px;
 --rn-float:0 12px 32px color-mix(in srgb,#000 16%,transparent),0 2px 8px color-mix(in srgb,#000 8%,transparent);
 --rn-ease:cubic-bezier(.2,.7,.2,1);
 font-family:var(--rn-font-ui)!important;color:var(--rn-fg);background:var(--rn-bg);
 -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
 padding:0 clamp(14px,2.6vw,32px) 32px!important;
}
.rnw ::selection{background:color-mix(in srgb,var(--rn-brand) 26%,transparent)}
.rnw #rn-panel{max-width:1320px!important;outline:none}
.rnw .rn-num{font-family:var(--rn-font-num);font-variant-numeric:lining-nums tabular-nums;font-weight:600;letter-spacing:-.01em}
.rnw .rn-muted{color:var(--rn-sub);line-height:1.65}
.rnw .rn-icon{flex:none;display:block}
.rnw .rn-chip{display:inline-flex;align-items:center;padding:0 8px;border-radius:999px;background:var(--rn-surface-2);color:var(--rn-fg);font-size:11.5px;line-height:1.8}

/* ---------- 页头：关系脉搏 ---------- */
.rnw .rn-head{position:sticky;top:0;z-index:40;display:flex!important;align-items:center!important;justify-content:space-between;gap:16px!important;margin:0 calc(-1 * clamp(14px,2.6vw,32px))!important;padding:14px clamp(14px,2.6vw,32px)!important;background:color-mix(in srgb,var(--rn-bg) 86%,transparent);backdrop-filter:saturate(1.5) blur(14px);-webkit-backdrop-filter:saturate(1.5) blur(14px);border-bottom:1px solid var(--rn-line-soft)}
.rnw .rn-identity-strip{display:flex;align-items:center;gap:12px;min-width:0;flex:1 1 auto}
.rnw .rn-identity-avatar{flex:none;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;overflow:hidden;background:var(--rn-brand-soft);color:var(--rn-brand-text);font-size:18px;font-weight:700;box-shadow:0 0 0 2px var(--rn-bg),0 0 0 4px color-mix(in srgb,var(--rn-pulse) 55%,var(--rn-bg))}
.rnw .rn-identity-avatar.brand{box-shadow:none;border-radius:14px}
.rnw .rn-identity-avatar img{width:100%;height:100%;object-fit:cover}
.rnw .rn-identity{min-width:7em}
.rnw .rn-identity-name{display:block;font-size:19px;font-weight:700;letter-spacing:-.2px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rnw .rn-head-sub{display:flex!important;flex-wrap:wrap;align-items:center;gap:2px 12px!important;margin:2px 0 0!important;font-size:12px;color:var(--rn-sub)}
.rnw .rn-head-tools{display:flex;align-items:center;gap:10px;flex:none}
.rnw .rn-head-tools label{flex-direction:row!important;align-items:center;gap:8px!important;font-size:12px;color:var(--rn-sub);white-space:nowrap}
.rnw .rn-head-tools label select{width:150px!important;min-height:44px;font-weight:600;color:var(--rn-fg)}
.rnw .rn-pulse{display:inline-flex!important;align-items:center;gap:10px!important;padding:4px 12px 4px 10px!important;border:1px solid var(--rn-line)!important;border-radius:var(--rn-r)!important;background:var(--rn-bg)!important;color:var(--rn-fg)!important}
.rnw .rn-pulse:hover{border-color:color-mix(in srgb,var(--rn-pulse) 45%,var(--rn-line))!important;background:var(--rn-pulse-soft)!important}
.rnw .rn-pulse-line polyline{fill:none;stroke:var(--rn-pulse);stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round}
.rnw .rn-pulse-line circle{fill:var(--rn-pulse)}
.rnw .rn-pulse-mid{stroke:var(--rn-line);stroke-dasharray:2 3}
.rnw .rn-pulse-copy{display:grid;justify-items:start;line-height:1.05}
.rnw .rn-pulse-copy strong{font-size:22px;color:var(--rn-pulse-text)}
.rnw .rn-pulse-copy small{font-size:10.5px;color:var(--rn-sub);margin-top:2px}

/* ---------- 一级导航（桌面：图标标签；手机：底部标签栏） ---------- */
.rnw .rn-tabs.rn-group-tabs{display:flex!important;gap:4px!important;margin:14px 0 0!important;padding:0!important;border:0!important;background:transparent;overflow-x:auto;scrollbar-width:none}
.rnw .rn-tabs.rn-group-tabs::-webkit-scrollbar{display:none}
.rnw .rn-group-tabs button{display:inline-flex!important;align-items:center;gap:8px!important;min-height:44px;padding:8px 14px!important;border:0!important;border-radius:12px!important;background:transparent!important;color:var(--rn-sub)!important;font-weight:550;transition:background .16s var(--rn-ease),color .16s}
.rnw .rn-group-tabs button:hover{background:var(--rn-hover)!important;color:var(--rn-fg)!important}
.rnw .rn-group-tabs button[aria-selected=true]{background:var(--rn-brand-soft)!important;color:var(--rn-brand-text)!important;font-weight:650;box-shadow:none}

/* ---------- 页标题与页内标签 ---------- */
.rnw .rn-page-head h1{margin:22px 0 2px!important;font-size:26px!important;line-height:1.25;font-weight:700;letter-spacing:-.5px}
.rnw .rn-breadcrumb{display:none!important}
.rnw .rn-tabs.rn-context-tabs{gap:2px!important;margin:6px 0 22px!important;border-bottom:1px solid var(--rn-line)!important;scrollbar-width:none}
.rnw .rn-tabs.rn-context-tabs::-webkit-scrollbar{display:none}
.rnw .rn-context-tabs button{position:relative;padding:10px 12px 12px!important;border:0!important;border-radius:8px 8px 0 0!important;background:transparent!important;color:var(--rn-sub);font-size:14px;transition:color .15s}
.rnw .rn-context-tabs button:hover{color:var(--rn-fg)}
.rnw .rn-context-tabs button[aria-selected=true]{color:var(--rn-fg);font-weight:650;border-bottom:0!important}
.rnw .rn-context-tabs button[aria-selected=true]::after{content:"";position:absolute;left:12px;right:12px;bottom:-1px;height:2.5px;border-radius:2px;background:var(--rn-brand)}

/* ---------- 按钮 ---------- */
.rnw button{border:1px solid var(--rn-line);border-radius:var(--rn-r-sm);background:var(--rn-bg);color:var(--rn-fg);font-weight:550;gap:6px;transition:background .15s var(--rn-ease),border-color .15s,color .15s,transform .08s}
.rnw button:not(:disabled):hover{background:var(--rn-surface-2);border-color:color-mix(in srgb,var(--rn-fg) 16%,var(--rn-line))}
.rnw button:not(:disabled):active{transform:translateY(1px)}
.rnw button.primary{background:var(--rn-brand)!important;color:var(--rn-brand-fg)!important;border-color:transparent!important;padding-left:16px!important;padding-right:16px!important}
.rnw button.primary:not(:disabled):hover{background:color-mix(in srgb,var(--rn-brand) 86%,#000)!important}
.rnw button:disabled{opacity:.5;cursor:not-allowed}
.rnw button.primary:disabled{background:color-mix(in srgb,var(--rn-brand) 42%,var(--rn-bg))!important;opacity:1}
.rnw button[aria-pressed=true]:not(.primary):not(.rn-day){background:var(--rn-brand-soft);border-color:var(--rn-brand-line);color:var(--rn-brand-text);font-weight:650}
.rnw :focus-visible{outline:2px solid color-mix(in srgb,var(--rn-brand) 75%,var(--ring,#6b83ac))!important;outline-offset:2px}

/* ---------- 表单：填充式输入框 ---------- */
.rnw input:not([type=checkbox]):not([type=file]):not([type=radio]),.rnw select,.rnw textarea{border:1px solid transparent!important;border-radius:var(--rn-r-sm)!important;background-color:var(--rn-surface-2)!important;color:var(--rn-fg);transition:border-color .15s,box-shadow .15s,background-color .15s}
.rnw input:not([type=checkbox]):not([type=file]):not([type=radio]):hover,.rnw select:hover,.rnw textarea:hover{background-color:color-mix(in srgb,var(--rn-fg) 8.5%,var(--rn-bg))!important}
.rnw input:not([type=checkbox]):not([type=file]):not([type=radio]):focus,.rnw select:focus,.rnw textarea:focus{outline:none;border-color:var(--rn-brand)!important;background-color:var(--rn-bg)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--rn-brand) 18%,transparent)}
.rnw ::placeholder{color:color-mix(in srgb,var(--rn-sub) 80%,transparent)}
.rnw label{font-size:12.5px;font-weight:550;color:var(--rn-sub)}
.rnw label>select,.rnw label>input,.rnw label>textarea{font-weight:400;color:var(--rn-fg)}
.rnw input[type=checkbox],.rnw input[type=radio]{accent-color:var(--rn-brand);width:16px;height:16px}
.rnw .rn-check{color:var(--rn-fg);font-size:var(--rn-font,13px);font-weight:400}

/* ---------- 分区（平面）与特写卡 ---------- */
.rnw .rn-box{border:1px solid var(--rn-line)!important;border-radius:var(--rn-r-lg)!important;background:var(--rn-bg);box-shadow:none!important;padding:clamp(18px,2.2vw,26px)!important}
.rnw .rn-box+.rn-box,.rnw .rn-box+section,.rnw section+.rn-box{margin-top:16px}
.rnw .rn-box>h2,.rnw .rn-empty>h2{font-size:18px!important;font-weight:700;letter-spacing:-.2px;margin:0 0 14px!important}
.rnw .rn-box>h2::before{content:none!important}
.rnw h3{font-size:15px;font-weight:650;letter-spacing:-.1px}
.rnw .rn-split{gap:16px}
/* 阅读宽度：说明文字与表单不随宽屏无限拉长 */
.rnw .rn-box>p.rn-muted,.rnw .rn-empty>p.rn-muted{max-width:72ch}
.rnw .rn-empty>p.rn-muted{margin-left:auto;margin-right:auto}
.rnw .rn-self-profile,.rnw .rn-paste-import{max-width:760px}
/* 特写：一页最多一个——首次引导、关系分析的总览 */
.rnw .rn-empty,.rnw .rn-insight-hero{background:color-mix(in srgb,var(--rn-brand) 4.5%,var(--rn-bg))!important;border:1px solid var(--rn-brand-line)!important;border-radius:22px!important}

/* ---------- 指标：条目层（浅底、无边框） ---------- */
.rnw .rn-metrics{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px!important;border:0!important;padding:0!important;margin-bottom:16px}
.rnw .rn-metric{padding:14px 16px!important;border:0!important;border-radius:var(--rn-r)!important;background:var(--rn-surface);color:var(--rn-sub);font-size:12.5px;min-width:0!important}
.rnw .rn-metric strong{font-family:var(--rn-font-num);font-variant-numeric:lining-nums tabular-nums;font-size:26px!important;font-weight:500!important;color:var(--rn-fg);letter-spacing:-.3px;margin:6px 0 2px!important}

/* ---------- 折叠项 ---------- */
.rnw details>summary{list-style:none;position:relative;padding-left:22px!important;border-radius:8px;transition:color .15s}
.rnw details>summary::-webkit-details-marker{display:none}
.rnw details>summary::before{content:"";position:absolute;left:5px;top:50%;width:7px;height:7px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:translateY(-70%) rotate(-45deg);opacity:.55;transition:transform .18s var(--rn-ease)}
.rnw details[open]>summary::before{transform:translateY(-75%) rotate(45deg)}
.rnw details>summary:hover{color:var(--rn-brand-text)}
.rnw .rn-profile-menu>summary,.rnw .rn-settings-menu>summary{padding-left:0!important}
.rnw .rn-profile-menu>summary::before,.rnw .rn-settings-menu>summary::before{display:none}
.rnw .rn-more{border:1px solid var(--rn-line)!important;border-radius:var(--rn-r-lg)!important;background:var(--rn-bg)}

/* ---------- 浮层：菜单 / 提示条 ---------- */
.rnw .rn-settings-menu>summary{width:44px;height:44px;border:1px solid var(--rn-line)!important;border-radius:12px!important;background:var(--rn-bg);color:var(--rn-sub);transition:background .15s,color .15s}
.rnw .rn-settings-menu>summary:hover,.rnw .rn-settings-menu[open]>summary{background:var(--rn-surface-2);color:var(--rn-fg)}
.rnw .rn-settings-menu-items,.rnw .rn-profile-menu-items{border:1px solid var(--rn-line)!important;border-radius:var(--rn-r)!important;background:var(--rn-bg)!important;box-shadow:var(--rn-float)!important;padding:6px!important;animation:rn-pop .14s var(--rn-ease)}
.rnw .rn-settings-menu-items button,.rnw .rn-profile-menu-items button{border:0!important;justify-content:flex-start;border-radius:8px!important}
.rnw .rn-profile-menu>summary{color:var(--rn-sub)!important}
.rnw .rn-profile-menu>summary:hover{background:var(--rn-hover)!important}
@keyframes rn-pop{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}
@keyframes rn-fade{from{opacity:0}to{opacity:1}}
.rnw .rn-toast{position:sticky;bottom:16px;z-index:70;display:flex;align-items:center;gap:10px;width:fit-content;max-width:min(680px,100%);margin:18px auto 0;padding:6px 6px 6px 16px;border:1px solid var(--rn-line);border-radius:var(--rn-r);background:var(--rn-bg);color:var(--rn-fg);box-shadow:var(--rn-float);animation:rn-pop .18s var(--rn-ease)}
.rnw .rn-toast::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--rn-brand);flex:none}
.rnw .rn-toast.rn-toast-error::before{background:var(--rn-danger)}
.rnw .rn-toast>span{flex:1;min-width:0;font-size:13px;line-height:1.5}
.rnw .rn-toast>button{border:0!important;color:var(--rn-sub);font-size:18px;line-height:1;padding:0!important;border-radius:10px!important;background:transparent}
.rnw .rn-error{color:var(--rn-danger)}

/* ---------- 来源筛选（分段） ---------- */
.rnw .rn-source-filter{display:inline-flex!important;gap:2px!important;padding:3px;margin:0 0 18px!important;border-radius:12px;background:var(--rn-surface-2)}
.rnw .rn-source-filter button{border:0!important;border-radius:9px!important;padding:6px 14px!important;background:transparent!important;color:var(--rn-sub)!important;font-weight:550}
.rnw .rn-source-filter button[aria-pressed=true]{background:var(--rn-bg)!important;color:var(--rn-fg)!important;font-weight:650;box-shadow:0 1px 2px color-mix(in srgb,#000 10%,transparent)}

/* ---------- 首次引导 ---------- */
.rnw .rn-empty{padding:clamp(24px,4vw,44px) clamp(18px,3vw,36px)!important;text-align:center}
.rnw .rn-empty>h2{font-size:22px!important}
.rnw .rn-onboarding-steps{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))!important;gap:12px!important;padding-left:0!important;list-style:none;margin:24px 0 18px!important;counter-reset:rn-step}
.rnw .rn-onboarding-steps>li{counter-increment:rn-step;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:18px;border-radius:var(--rn-r);background:var(--rn-bg);border:1px solid var(--rn-line-soft);text-align:left}
.rnw .rn-onboarding-steps>li::before{content:counter(rn-step);display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--rn-brand-soft);color:var(--rn-brand-text);font-family:var(--rn-font-num);font-weight:700;font-size:14px;margin-bottom:8px}
.rnw .rn-onboarding-steps>li>.rn-muted{flex:1;margin:2px 0 12px}
.rnw .rn-upload{border:1.5px dashed var(--rn-brand-line)!important;border-radius:var(--rn-r-lg)!important;background:var(--rn-brand-soft)!important;min-height:200px!important;transition:background .15s,border-color .15s}
.rnw .rn-upload.rn-drag{border-color:var(--rn-brand)!important;background:color-mix(in srgb,var(--rn-brand) 18%,var(--rn-bg))!important}
.rnw .rn-upload>span[aria-hidden]{display:grid;place-items:center;width:52px;height:52px;border-radius:16px;background:var(--rn-bg);color:var(--rn-brand)}

/* ---------- 身份确认 ---------- */
.rnw .rn-identity{display:block}
.rnw .rn-form.rn-identity{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:end;gap:12px}
@media(max-width:620px){.rnw .rn-form.rn-identity{grid-template-columns:1fr}.rnw .rn-form.rn-identity>button{justify-self:start}}

/* ---------- 列表条目（证据、事实、计划） ---------- */
.rnw .rn-message,.rnw .rn-fact,.rnw .rn-goal{border-bottom-color:var(--rn-line-soft)}
.rnw .rn-message{padding:16px 0}
.rnw .rn-source{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin:6px 0 0}
.rnw .rn-source>button{margin-left:auto;padding:4px 14px!important;font-size:12px;border-radius:999px!important;color:var(--rn-brand-text);border-color:var(--rn-brand-line)!important;background:transparent}
.rnw .rn-source>button:hover{background:var(--rn-brand-soft)!important}
.rnw blockquote{border-left:3px solid var(--rn-brand-line)!important;color:var(--rn-fg)!important;background:var(--rn-surface);padding:9px 14px!important;border-radius:0 10px 10px 0;margin:8px 0}
.rnw pre{background:var(--rn-surface-2)}
.rnw table{border-radius:12px;overflow:hidden;font-variant-numeric:tabular-nums}
.rnw th{background:var(--rn-surface)!important;color:var(--rn-sub);font-size:12px;font-weight:600}
.rnw th,.rnw td{border-bottom-color:var(--rn-line-soft)!important}
.rnw tbody tr:hover td{background:var(--rn-surface)}

/* ---------- 档案卡（条目层） ---------- */
.rnw .rn-profile-filters{display:inline-flex;gap:2px;padding:3px;border-radius:12px;background:var(--rn-surface-2)}
.rnw .rn-profile-filters button{color:var(--rn-sub)!important;border-radius:9px!important;border:0!important}
.rnw .rn-profile-filters button[aria-pressed=true]{background:var(--rn-bg)!important;color:var(--rn-fg)!important;box-shadow:0 1px 2px color-mix(in srgb,#000 10%,transparent)}
.rnw .rn-profile-card{border:0!important;border-radius:var(--rn-r)!important;background:var(--rn-surface)!important}
.rnw .rn-profile-evidence,.rnw .rn-profile-card-head>small,.rnw .rn-profile-date{color:var(--rn-sub)!important}
.rnw .rn-profile-comparison{background:var(--rn-surface-2)!important}
.rnw .rn-profile-undo{background:var(--rn-brand-soft)!important;color:var(--rn-brand-text)}

/* ---------- 日历与图表 ---------- */
.rnw .rn-calendar-wrap,.rnw .rn-annual-data{border-color:var(--rn-line)!important;border-radius:var(--rn-r)!important}
.rnw .rn-annual-card,.rnw .rn-rule-card{border:0!important;border-radius:var(--rn-r)!important;background:var(--rn-surface)}
.rnw .rn-calendar-weekday,.rnw .rn-calendar-cell{border-color:var(--rn-line-soft)!important}
.rnw .rn-calendar-cell.empty{background:var(--rn-surface)}
.rnw .rn-day{border-radius:10px!important;transition:background .15s,border-color .15s}
.rnw .rn-day:hover{border-color:var(--rn-brand-line)!important}
.rnw .rn-day[aria-pressed="true"]{border-color:var(--rn-brand)!important;box-shadow:inset 0 0 0 1px var(--rn-brand)}
.rnw .rn-day-affinity,.rnw .rn-rule-value,.rnw .rn-rule-formula li b{color:var(--rn-brand-text)!important}
.rnw .rn-rule-value{background:var(--rn-surface-2)!important}
.rnw .rn-rule-formula li,.rnw .rn-metric-scale{border-left-color:var(--rn-brand-line)!important}
.rnw .rn-day-gap{border-color:var(--rn-line)!important}
.rnw .rn-annual-granularity{border:0!important;background:var(--rn-surface-2);border-radius:11px!important;padding:3px!important}
.rnw .rn-annual-granularity button{border:0!important;border-radius:8px!important;min-width:40px;justify-content:center}
.rnw .rn-annual-granularity button[aria-pressed=true]{background:var(--rn-bg)!important;color:var(--rn-fg)!important;box-shadow:0 1px 2px color-mix(in srgb,#000 10%,transparent)}
.rnw .rn-annual-trend .rn-annual-chart text{font-size:15px!important}
.rnw .rn-annual-chart line{stroke:var(--rn-line)}
.rnw .rn-annual-pie-row{background:var(--rn-bg)!important}
.rnw .rn-progress-track{background:var(--rn-surface-2)!important}
.rnw .rn-progress-fill{background:var(--rn-brand)!important}
.rnw .rn-progress-value,.rnw .rn-channel-block h4{color:var(--rn-sub)!important}

/* ---------- 会话 ---------- */
.rnw .rn-session-pane{border:1px solid var(--rn-line)!important;background:var(--rn-bg)!important;border-radius:var(--rn-r-lg)!important;box-shadow:none}
.rnw .rn-session-list h3,.rnw .rn-session-contact-copy small,.rnw .rn-session-heading small,.rnw .rn-session-message-meta,.rnw .rn-session-compose-tools label,.rnw .rn-session-status,.rnw .rn-session-stat small,.rnw .rn-session-photo-empty{color:var(--rn-sub)!important}
.rnw .rn-session-contact{background:var(--rn-brand-soft)!important;border-radius:12px!important}
.rnw .rn-session-links button{border-radius:8px!important;border:0!important}
.rnw .rn-session-avatar{background:var(--rn-brand-soft)!important;color:var(--rn-brand-text)!important;box-shadow:0 0 0 2px var(--rn-bg)}
.rnw .rn-session-header{gap:8px!important}
.rnw .rn-session-header>button:nth-of-type(2){margin-left:-18px}
.rnw .rn-session-header>button:nth-of-type(2) .rn-session-avatar{width:26px;height:26px;flex-basis:26px;font-size:11px;align-self:flex-end;margin-top:14px}
.rnw .rn-session-header>button:nth-of-type(-n+2){background:transparent!important;min-width:0!important;border:0!important}
.rnw .rn-session-heading strong{font-size:15px!important}
.rnw .rn-session-history{background:var(--rn-surface)!important;border:0;border-radius:var(--rn-r-lg)!important}
.rnw .rn-session-day{background:var(--rn-bg)!important;color:var(--rn-sub)!important;font-variant-numeric:tabular-nums;box-shadow:0 0 0 1px var(--rn-line-soft)}
.rnw .rn-session-bubble{background:var(--rn-bg)!important;border-color:var(--rn-line-soft)!important;border-radius:4px 16px 16px 16px!important}
.rnw .rn-session-message.self .rn-session-bubble{background:color-mix(in srgb,var(--rn-brand) 17%,var(--rn-bg))!important;border-color:transparent!important;border-radius:16px 4px 16px 16px!important}
.rnw .rn-media-placeholder,.rnw .rn-session-message.self .rn-media-placeholder{background:var(--rn-surface-2)!important;color:var(--rn-sub)!important}
.rnw .rn-session-media{background:var(--rn-surface-2)!important}
.rnw .rn-session-draft{border:1px solid var(--rn-brand-line)!important;background:color-mix(in srgb,var(--rn-brand) 3%,var(--rn-bg))!important;border-radius:var(--rn-r-lg)!important}
.rnw .rn-session-draft>strong{display:inline-flex;align-items:center;gap:6px;color:var(--rn-brand-text)!important}
.rnw .rn-session-draft>strong::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--rn-brand)}
.rnw .rn-session-photo{background:var(--rn-surface)!important;border:1px dashed var(--rn-line);border-radius:var(--rn-r-lg)!important}
.rnw .rn-session-stat{background:var(--rn-surface)!important}
.rnw .rn-session-details,.rnw .rn-session-exchange{border-top-color:var(--rn-line-soft)!important}
.rnw .rn-history-toolbar label{color:var(--rn-sub)}

/* ---------- 预览聊天、交流记录 ---------- */
.rnw .rn-chat-preview{background:var(--rn-surface)!important;border:0!important;border-radius:var(--rn-r-lg)!important}
.rnw .rn-chat-title{border-bottom-color:var(--rn-line-soft)!important}
.rnw .rn-chat-avatar{background:var(--rn-surface-2)!important;color:var(--rn-sub)!important}
.rnw .rn-chat-row.outgoing .rn-chat-avatar{background:var(--rn-brand-soft)!important;color:var(--rn-brand-text)!important}
.rnw .rn-chat-bubble{background:var(--rn-bg)!important;border-color:var(--rn-line-soft)!important}
.rnw .rn-chat-row.outgoing .rn-chat-bubble{background:color-mix(in srgb,var(--rn-brand) 17%,var(--rn-bg))!important;border-color:transparent!important}
.rnw .rn-exchange{border:0!important;background:var(--rn-surface)!important;border-radius:var(--rn-r)!important}
.rnw .rn-preview-sections>section,.rnw .rn-media-card{border-color:var(--rn-line-soft)!important;border-radius:var(--rn-r)!important}

/* ---------- 行动计划 ---------- */
.rnw .rn-goal-form{grid-template-columns:repeat(2,minmax(0,1fr));align-items:end;padding:16px;border-radius:var(--rn-r);background:var(--rn-surface);margin-bottom:14px}
.rnw .rn-goal-form>:first-child{grid-column:1/-1}
.rnw .rn-goal-form>button{grid-column:1/-1;justify-self:start;min-width:120px;justify-content:center}
.rnw .rn-goal-form input:not([type=checkbox]){background-color:var(--rn-bg)!important}

/* ---------- 原文浮层 ---------- */
.rn-evidence-overlay{backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);animation:rn-fade .15s ease}
.rn-evidence-overlay>[role=dialog]{box-shadow:0 20px 50px color-mix(in srgb,#000 22%,transparent);border:1px solid var(--border,var(--dsw-alias-border-l2,#e3e7e4));border-radius:20px!important;animation:rn-pop .18s cubic-bezier(.2,.7,.2,1)}

/* ---------- 滚动条 ---------- */
.rnw *{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--rn-fg) 18%,transparent) transparent}
.rnw ::-webkit-scrollbar{width:10px;height:10px}
.rnw ::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--rn-fg) 16%,transparent);border-radius:10px;border:3px solid transparent;background-clip:content-box}

/* ---------- 手机：底部标签栏、紧凑页头 ---------- */
@media(max-width:620px){
 .rnw{padding-bottom:calc(92px + env(safe-area-inset-bottom))!important}
 .rnw .rn-head{padding-top:10px!important;padding-bottom:10px!important;gap:10px!important}
 .rnw .rn-identity-avatar{width:38px;height:38px;font-size:16px}
 .rnw .rn-identity-name{font-size:17px}
 .rnw .rn-head-tools{gap:6px}
 .rnw .rn-head-tools label{font-size:0;gap:0!important}
 .rnw .rn-head-tools label select{width:96px!important;font-size:13px}
 .rnw .rn-head-tools>button.primary{padding:0 12px!important}
 .rnw .rn-head-sub{font-size:11.5px}
 .rnw .rn-pulse{padding:4px 8px!important;gap:6px!important}
 .rnw .rn-pulse-line{width:56px}
 .rnw .rn-pulse-copy small{display:none}
 .rnw .rn-tabs.rn-group-tabs{position:fixed;left:0;right:0;bottom:0;z-index:85;display:grid!important;grid-template-columns:repeat(4,1fr);gap:0!important;margin:0!important;padding:6px 8px calc(6px + env(safe-area-inset-bottom))!important;background:color-mix(in srgb,var(--rn-bg) 92%,transparent);backdrop-filter:saturate(1.5) blur(16px);-webkit-backdrop-filter:saturate(1.5) blur(16px);border-top:1px solid var(--rn-line)!important;overflow:visible}
 .rnw .rn-group-tabs button{flex-direction:column;justify-content:center;gap:3px!important;min-height:52px;padding:6px 2px!important;font-size:11px;border-radius:12px!important}
 .rnw .rn-group-tabs button[aria-selected=true]{background:transparent!important}
 .rnw .rn-group-tabs button[aria-selected=true] .rn-icon{background:var(--rn-brand-soft);border-radius:999px;padding:2px 14px;box-sizing:content-box}
 .rnw .rn-page-head h1{font-size:22px!important;margin-top:16px!important}
 .rnw .rn-context-tabs button{font-size:13.5px}
 .rnw .rn-toast{bottom:calc(84px + env(safe-area-inset-bottom))}
 .rnw .rn-box{border-radius:16px!important}
 /* 会话工具栏：来源 + 搜索一行，日期 + 最新一行 */
 .rnw .rn-history-toolbar{grid-template-columns:84px minmax(0,1fr) 64px!important}
 .rnw .rn-history-toolbar label{font-size:0!important;gap:0!important}
 .rnw .rn-history-toolbar label select{font-size:13px}
 .rnw .rn-history-toolbar input[type=search]{grid-column:2/4}
 .rnw .rn-history-toolbar input[type=date]{grid-column:1/3!important}
}
@media (prefers-reduced-motion:reduce){.rnw *,.rn-evidence-overlay,.rn-evidence-overlay *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
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
.rnw .rn-tag-ai{background:color-mix(in srgb,var(--rn-ai) 13%,var(--rn-bg));color:color-mix(in srgb,var(--rn-ai) 82%,var(--rn-fg))}
.rnw .rn-tag-inference{background:color-mix(in srgb,var(--rn-amber) 15%,var(--rn-bg));color:color-mix(in srgb,var(--rn-amber) 85%,var(--rn-fg))}
.rnw .rn-insight-alert{padding:14px 16px;border-radius:14px;border:1px solid color-mix(in srgb,var(--rn-danger) 40%,var(--rn-bg));background:var(--rn-danger-soft)}
.rnw .rn-insight-alert.soft{border-color:color-mix(in srgb,var(--rn-amber) 40%,var(--rn-bg));background:color-mix(in srgb,var(--rn-amber) 10%,var(--rn-bg))}
.rnw .rn-insight-alert p{margin:4px 0 0}
.rnw .rn-insight-hero-main{display:grid;grid-template-columns:minmax(200px,1fr) minmax(0,1.6fr);gap:20px;align-items:start}
.rnw .rn-insight-score{display:flex;align-items:baseline;gap:6px;margin:4px 0}
.rnw .rn-insight-score strong{font-family:var(--rn-font-num);font-size:60px;line-height:1;font-weight:600;letter-spacing:-1px;font-variant-numeric:lining-nums tabular-nums;color:var(--rn-pulse-text)}
.rnw .rn-insight-score span{color:var(--rn-sub)}
.rnw .rn-insight-facts{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.rnw .rn-insight-facts li{display:grid;gap:3px;padding:14px 16px;border-radius:var(--rn-r);background:var(--rn-bg)}
.rnw .rn-insight-facts li>span{font-size:12px;color:var(--rn-sub)}
.rnw .rn-insight-facts li>strong{font-size:17px;font-weight:700}
.rnw .rn-insight-facts li>small{color:var(--rn-sub);font-size:11.5px;line-height:1.5}
.rnw .rn-tone-up{color:var(--rn-brand-text)!important}
.rnw .rn-tone-down{color:var(--rn-danger)!important}
.rnw .rn-tone-flat{color:var(--rn-fg)}
.rnw .rn-insight-actions{display:grid;gap:10px;margin-top:18px;padding-top:16px;border-top:1px solid var(--rn-brand-line)}
.rnw .rn-insight-actions>button{justify-self:start}
.rnw .rn-insight-progress{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.rnw .rn-insight-legend{margin:0;font-size:12px;color:var(--rn-sub);line-height:2}
.rnw .rn-insight-disclaimer{margin:10px 0 0;font-size:12px;color:var(--rn-sub)}
.rnw .rn-insight-chart{display:block;width:100%;height:auto;max-height:280px}
.rnw .rn-insight-grid{stroke:var(--rn-line);stroke-width:1}
.rnw .rn-insight-axis{fill:var(--rn-sub);font-size:11px;font-family:inherit}
.rnw .rn-insight-band{fill:color-mix(in srgb,var(--rn-pulse) 13%,transparent)}
.rnw .rn-insight-line{fill:none;stroke:var(--rn-pulse);stroke-width:2.2;stroke-linejoin:round}
.rnw .rn-insight-ewma{fill:none;stroke:var(--rn-fg);stroke-width:1.5;stroke-dasharray:5 4;opacity:.55}
.rnw .rn-insight-cp{stroke:var(--rn-amber);stroke-width:1.5;stroke-dasharray:3 3}
.rnw .rn-insight-dot{fill:var(--rn-bg);stroke:var(--rn-pulse);stroke-width:2;cursor:pointer}
.rnw .rn-insight-dot.selected{fill:var(--rn-pulse)}
.rnw .rn-insight-dot:focus-visible{outline:none;stroke-width:4}
.rnw .rn-insight-gap{fill:none;stroke:var(--rn-sub);stroke-dasharray:2 2}
.rnw .rn-insight-chart-legend{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;margin:6px 0 0;font-size:12px;color:var(--rn-sub)}
.rnw .rn-insight-chart-legend .sw{display:inline-block;width:16px;height:3px;border-radius:2px;margin-left:6px}
.rnw .sw.line{background:var(--rn-pulse)}.rnw .sw.band{height:10px;background:color-mix(in srgb,var(--rn-pulse) 18%,transparent)}.rnw .sw.ewma{background:repeating-linear-gradient(90deg,var(--rn-fg) 0 4px,transparent 4px 7px);opacity:.6}.rnw .sw.cp{width:3px;height:12px;background:var(--rn-amber)}.rnw .sw.gap{width:7px;height:7px;border:1px dashed var(--rn-sub);border-radius:50%}
.rnw .rn-insight-phases{display:grid;gap:8px;margin:14px 0 0;padding-left:20px}
.rnw .rn-insight-phases li>div{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
.rnw .rn-insight-phases small{color:var(--rn-sub)}
.rnw .rn-insight-phases p{margin:2px 0 0;font-size:12.5px}
.rnw .rn-insight-week-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;margin:-4px 0 12px;font-size:12.5px;color:var(--rn-sub)}
.rnw .rn-insight-week-pick{flex-direction:row!important;align-items:center;margin-left:auto}
.rnw .rn-insight-week-pick select{width:auto;min-width:170px}
.rnw .rn-insight-summary{padding:14px 16px;margin-bottom:14px;border-radius:var(--rn-r);background:color-mix(in srgb,var(--rn-ai) 6%,var(--rn-bg))}
.rnw .rn-insight-summary p{margin:6px 0 0}
.rnw .rn-insight-dims{display:grid;gap:8px}
.rnw .rn-insight-dim{border:1px solid var(--rn-line-soft);border-radius:var(--rn-r);background:var(--rn-bg);overflow:hidden;transition:border-color .15s}
.rnw .rn-insight-dim:hover{border-color:var(--rn-line)}
.rnw .rn-insight-dim.open{border-color:var(--rn-brand-line)}
.rnw .rn-insight-dim-head{display:grid!important;grid-template-columns:96px minmax(80px,1fr) 40px 250px;align-items:center;gap:6px 14px;width:100%;padding:10px 14px!important;border:0!important;border-radius:0!important;text-align:left;background:transparent}
.rnw .rn-insight-dim-name{font-weight:650}
.rnw .rn-insight-dim-val{font-family:var(--rn-font-num);font-size:17px;font-weight:600;font-variant-numeric:lining-nums tabular-nums;text-align:right}
.rnw .rn-insight-dim-meta{font-size:11.5px;color:var(--rn-sub);white-space:nowrap;text-align:right;overflow:hidden;text-overflow:ellipsis}
.rnw .rn-insight-flag{grid-column:1/-1;justify-self:start;font-size:11.5px;padding:1px 8px;border-radius:999px;background:color-mix(in srgb,var(--rn-amber) 14%,var(--rn-bg));color:color-mix(in srgb,var(--rn-amber) 85%,var(--rn-fg))}
.rnw .rn-insight-bar{position:relative;height:8px;border-radius:99px;background:var(--rn-surface-2)}
.rnw .rn-insight-bar>i{position:absolute;inset:0 auto 0 0;border-radius:99px;background:var(--rn-brand)}
.rnw .rn-insight-bar.friction>i{background:var(--rn-danger)}
.rnw .rn-insight-tick{position:absolute;top:-4px;width:2px;height:16px;border-radius:1px;transform:translateX(-1px)}
.rnw .rn-insight-tick.rule{background:var(--rn-fg);opacity:.55}
.rnw .rn-insight-tick.ai{background:var(--rn-ai)}
.rnw .rn-insight-dim-body{padding:4px 14px 14px;border-top:1px solid var(--rn-line)}
.rnw .rn-insight-method{margin:6px 0 10px;font-size:12.5px}
.rnw .rn-insight-refs{margin:6px 0 0;padding-left:18px;font-size:12px;color:var(--rn-sub)}
.rnw .rn-insight-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.rnw .rn-insight-columns h4{display:flex;align-items:center;gap:6px;margin:6px 0 8px;font-size:12.5px}
.rnw .rn-insight-quotes{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.rnw .rn-insight-quote{padding:12px 14px;border:0;border-radius:12px;background:var(--rn-surface)}
.rnw .rn-insight-quote-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px}
.rnw .rn-insight-quote-head small{color:var(--rn-sub)}
.rnw .rn-insight-quote blockquote{margin:6px 0}
.rnw .rn-insight-note,.rnw .rn-insight-count{margin:4px 0;font-size:12.5px}
.rnw .rn-insight-open{font-size:12px;padding:2px 12px!important;border-radius:999px!important;color:var(--rn-brand-text);border-color:var(--rn-brand-line)!important;background:transparent}
.rnw .rn-insight-inference{margin-top:10px;padding:12px 14px;border-radius:12px;border:1px dashed color-mix(in srgb,var(--rn-amber) 45%,var(--rn-bg));background:color-mix(in srgb,var(--rn-amber) 7%,var(--rn-bg))}
.rnw .rn-insight-inference>div{display:flex;align-items:center;gap:8px}
.rnw .rn-insight-inference small{color:var(--rn-sub)}
.rnw .rn-insight-inference p{margin:6px 0 0}
.rnw .rn-insight-alt{font-size:12.5px;color:var(--rn-sub)}
.rnw .rn-insight-boundary{margin-top:14px}
.rnw .rn-insight-about table{margin:8px 0;font-size:12.5px}
.rnw .rn-insight-about li{margin:6px 0;font-size:12.5px;line-height:1.7}
@media(max-width:620px){.rnw .rn-insight-axis{font-size:20px}.rnw .rn-insight-chart{max-height:none}}
@media(max-width:760px){.rnw .rn-insight-facts{grid-template-columns:1fr;gap:6px}.rnw .rn-insight-facts li{grid-template-columns:1fr auto;align-items:baseline;padding:10px 14px}.rnw .rn-insight-facts li>small{grid-column:1/-1}.rnw .rn-insight-facts li>strong{font-size:15px}.rnw .rn-insight-hero-main,.rnw .rn-insight-columns{grid-template-columns:1fr}.rnw .rn-insight-dim-head{grid-template-columns:80px minmax(60px,1fr) 34px}.rnw .rn-insight-dim-meta{grid-column:1/-1;white-space:normal;text-align:left}.rnw .rn-insight-week-pick{margin-left:0}.rnw .rn-insight-score strong{font-size:40px}}
`;
