# 关系手记（Relationship Notes）

DeepSeek Harness 自定义插件：本地微信聊天记录分析、每日好感线索打分、对方档案整理与回复草稿。
所有数据只存在浏览器 IndexedDB，不上传任何服务器。

## 评分公式

每日分（$d$ 为一天，$[\cdot]$ 为 0/1 指示函数）：

$$
S_d=\operatorname{clip}_{[0,100]}\Bigl(38+W_d-C_d+I_d+L_d-B_d-T_d-H_d\Bigr)
$$

$$
W_d=\min\Bigl(45,\ \min\bigl(24\,[n^{T}_d\ge 2]+12,\ 12P_d\bigr)+8Q_d+6R_d\Bigr)
$$

$$
C_d=\min\Bigl(60,\ 24b_d+\operatorname{round}(32\varepsilon_d)+5s_d+\max\bigl(18[m^{T}_d=0],\ 24[n^{T}_d=0]\bigr)\Bigr)
$$

$$
\varepsilon_d=\begin{cases}\min\bigl(1,\tfrac{f_d+g_d}{n^{T}_d}\bigr), & n^{T}_d>0\\ 0, & n^{T}_d=0\end{cases}
\qquad
I_d=20\cdot\frac{n^{\mathrm{init},T}_d}{n^{\mathrm{init}}_d}-10
$$

$$
L_d=\begin{cases}+6, & \tilde\ell_d\le 10\\ +3, & \tilde\ell_d\le 30\\ 0, & \tilde\ell_d\le 120\ \text{或无样本}\\ -7, & \tilde\ell_d\le 360\\ -12, & \tilde\ell_d>360\end{cases}
\qquad
B_d=\begin{cases}8, & \rho_d<0.2\\ 4, & \rho_d<0.35\\ 0, & \text{其他}\end{cases}
$$

$$
T_d=\begin{cases}\min\bigl(60,30\min(2,c_d)+10\min(3,a_d)\bigr), & c_d\ge2\ \text{或}\ (c_d\ge1\wedge a_d\ge1)\\ \min(12,12c_d), & \text{其他}\end{cases}
$$

$$
H_d=8\min\bigl(2,(n^{S}_d-1)^{+}\bigr)\cdot[n^{S}_d\ge2\wedge n^{T}_d=1]
$$

两条覆盖规则：

$$
S_d\leftarrow\min(S_d,48)\quad\text{当 }c_d\ge2\ \text{或}\ (c_d\ge1\wedge a_d\ge1)
$$

$$
S_d\leftarrow 32\quad\text{当 }N_d>0\wedge(n^{T}_d=0\vee N_d<4)\wedge b_d=c_d=P_d=f_d=g_d=0
$$

每月分（$w_d=\max(1,n^{T}_d)$）：

$$
M_k=\begin{cases}\operatorname{round}\bigl(32+(\bar S_k-32)\min(1,\tfrac{N_k}{20})\bigr), & \bar S_k>32\wedge N_k<20\\ \operatorname{round}(\bar S_k), & \text{其他}\end{cases}
$$

符号：$P_d,Q_d,R_d$ 对方正向措辞/提问/自我分享条数；$b_d,c_d,a_d$ 边界拒绝/反讽赌气/事后解释条数；
$f_d,g_d$ 敷衍与低信息量回合数；$n^{T}_d,n^{S}_d$ 双方发言回合数；$m^{S}_d,m^{T}_d$ 消息条数（$N_d=m^{S}+m^{T}$）；
$n^{\mathrm{init}}$ 对话段数（间隔 ≥2 小时切段）；$\tilde\ell_d$ 回复时延中位数（分钟）；$\rho_d$ 条数均衡比；$s_d$ 超 2 小时才回次数。

## 安装

1. 把 `relationship-plugin` 目录放到工作区。
2. 在 `%USERPROFILE%\.dsh\profiles\desktop\package.json` 的 `dependencies` 里加
   `"@local/relationship-notes": "link:<绝对路径>"`，并把插件名加进 `bundle` 列表。
3. 完全退出 DSH 再打开（仅刷新不会加载新 bundle）。

## 目录

- `src/` 源码（`workspace.js` UI、`analysis.js` 每日/总体分析、`interaction-signals.js` 评分内核）
- `client.js` 预构建前端产物（改 `src/` 后需 `node build.mjs` 重新生成）
- `locale/` 中英文案

## 测试

```bash
node --test bundle-smoke.test.mjs src/analysis.test.mjs src/analysis.daily.test.mjs src/interaction-metrics.test.mjs
```