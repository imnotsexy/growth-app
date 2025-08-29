"use client";

import { useEffect, useMemo, useState } from "react";

/** -----------------------------
 *  型定義（既存）
 *  ----------------------------*/
 type CategoryKey =
  | "運動"
  | "学習"
  | "習慣"
  | "信仰"
  | "人間力"
  | "金銭"
  | "睡眠"
  | "食事"
  | "メンタル";

type Quest = {
  id: string;
  title: string;
  done: boolean;
  enabled: boolean; // ON/OFF
};

type DayPlan = {
  day: number; // 1..7
  quests: Quest[];
};

type Theme = {
  backgroundColor: string;
  textColor: string;
};

type AppState = {
  selectedCategories: CategoryKey[];
  plans: DayPlan[]; // 7日
  createdAt?: string; // ISO
  theme?: Theme; // テーマ設定
};

/** -----------------------------
 *  チャット用型
 *  ----------------------------*/
 type ChatRole = "user" | "assistant";
 type ChatMsg = { role: ChatRole; content: string };

 /** -----------------------------
 *  点数計算とランク判定
 *  ----------------------------*/
type Rank = "入門者 (Novice)" | "従者 (Squire)" | "騎士 (Knight)" | "侯爵 (Marquis)" | "公爵 (Duke)" | "王者 (Sovereign)";

function calculateRank(score: number): Rank {
  if (score >= 1000) return "王者 (Sovereign)";
  if (score >= 500) return "公爵 (Duke)";
  if (score >= 200) return "侯爵 (Marquis)";
  if (score >= 100) return "騎士 (Knight)";
  if (score >= 50) return "従者 (Squire)";
  return "入門者 (Novice)";
}

/** -----------------------------
 *  定数（既存）
 *  ----------------------------*/
const ALL_CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "運動", label: "運動" },
  { key: "学習", label: "学習" },
  { key: "習慣", label: "習慣" },
  { key: "信仰", label: "信仰" },
  { key: "人間力", label: "社会性・人助け" },
  { key: "金銭", label: "金銭・資産形成" },
  { key: "睡眠", label: "睡眠" },
  { key: "食事", label: "食事" },
  { key: "メンタル", label: "メンタル" },
];

const TEMPLATE_QUESTS: Record<CategoryKey, string[]> = {
  運動: ["10分ストレッチ（首・肩・腰）", "軽いジョグ10分", "腕立て・腹筋・背筋 各10回"],
  学習: ["英単語15分", "読書20分", "講義ノートの復習10分"],
  習慣: ["デスク片付け5分", "洗濯物たたむ", "翌日のToDoを3つ書く"],
  信仰: ["日記3行（感謝）", "静かな祈り・瞑想5分", "善い行いを1つ"],
  人間力: ["誰かに挨拶＋一言", "家族/友人にLINEで近況", "ありがとうを3回伝える"],
  金銭: ["家計簿入力3分", "不要支出チェック", "投資/貯蓄を500円検討"],
  睡眠: ["就寝前のブルーライト10分カット", "就寝/起床時刻を記録", "水分を一杯飲む"],
  食事: ["水を1日1.5L目標", "サラダ/タンパク質を一品", "間食を一度スキップ"],
  メンタル: ["深呼吸3回", "3分瞑想", "散歩5分"],
};

const DEFAULT_THEME: Theme = {
  backgroundColor: "#ffffff",
  textColor: "#000000",
};

const STORAGE_KEY = "growth-planner-v1";

/** -----------------------------
 *  ユーティリティ
 *  ----------------------------*/
const uid = () => Math.random().toString(36).slice(2, 10);

function addScore(currentScore: number, points: number): { newScore: number; rank: Rank } {
  const newScore = currentScore + points;
  const rank = calculateRank(newScore);
  return { newScore, rank };
}

function buildWeekPlan(selected: CategoryKey[]): DayPlan[] {
  const days: DayPlan[] = [];
  for (let i = 1; i <= 7; i++) {
    const quests: Quest[] = [];
    selected.forEach((cat, idx) => {
      const candidates = TEMPLATE_QUESTS[cat];
      const base = (i + idx) % candidates.length;
      const titles = [candidates[base], candidates[(base + 1) % candidates.length]];
      titles.forEach((t) => quests.push({ id: uid(), title: `${t}`, done: false, enabled: true }));
    });
    const trimmed = quests.slice(0, 5);
    days.push({ day: i, quests: trimmed });
  }
  return days;
}

function loadState(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppState) : null;
  } catch {
    return null;
  }
}

function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** -----------------------------
 *  画面コンポーネント
 *  ----------------------------*/
 type Tab = "ホーム" | "クエスト" | "チャット" | "設定";

export default function Page() {
  const [tab, setTab] = useState<Tab>("ホーム"); // 現在のタブ
  const [menuOpen, setMenuOpen] = useState(false); // メニューの開閉状態を管理
  const [state, setState] = useState<AppState | null>(null); // アプリの全体状態
  const [selected, setSelected] = useState<CategoryKey[]>([]); // 選択中のカテゴリ
  const [score, setScore] = useState(0); // 現在のスコアを管理
  const hasPlan = !!state?.plans?.length; // プランが存在するか
  const toggleMenu = () => setMenuOpen((prev) => !prev); // メニューの開閉を切り替え

  
  useEffect(() => {
    const s = loadState();
    if (s) {
      setState(s);
      if (!s.plans?.length && s.selectedCategories?.length) {
        setSelected(s.selectedCategories);
      }
    }
  }, []);
  

  const handleQuestCompletion = (dayIdx: number, qid: string) => {
    toggleDone(dayIdx, qid); // クエストの完了状態を切り替え

    // クエスト達成時に10点を加算
    const { newScore, rank } = addScore(score, 10);
    setScore(newScore);

    console.log(`現在のスコア: ${newScore}, ランク: ${rank}`);
  };

  const todayIndex = useMemo(() => {
    if (!state?.createdAt) return 0;
    const created = new Date(state.createdAt);
    const diffMs = new Date().getTime() - created.getTime();
    const day = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(6, day));
  }, [state?.createdAt]);

  const todayPlan = state?.plans?.[todayIndex];

    // --- ここから背景色の適用 ---
  const backgroundStyle = {
  backgroundColor: "#f5f3f0", // 落ち着いたベージュ系
  minHeight: "100vh",
  } as const;
  // --- 背景色適用ここまで ---


  const toggleDone = (dayIdx: number, qid: string) => {
  if (!state) return;
  const copy = structuredClone(state) as AppState;
  const day = copy.plans[dayIdx];
  const q = day.quests.find((x) => x.id === qid);
  if (!q) return;

  // クエストの完了状態を切り替え
  q.done = !q.done;

  // スコアを更新
  if (q.done) {
    const { newScore } = addScore(score, 1); // 1点を加算
    setScore(newScore);
  } else {
    setScore((prev) => Math.max(0, prev - 1)); // 1点を減算（最低スコアは0）
  }

  setState(copy);
  saveState(copy);
};

  const toggleEnabled = (dayIdx: number, qid: string) => {
    if (!state) return;
    const copy = structuredClone(state) as AppState;
    const day = copy.plans[dayIdx];
    const q = day.quests.find((x) => x.id === qid);
    if (!q) return;
    q.enabled = !q.enabled;
    setState(copy);
    saveState(copy);
  };

  const resetAll = () => {
    setState(null);
    setSelected([]);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  };

  /** 初期カテゴリ選択ステップ（既存） */
  if (!hasPlan) {
    const toggleCategory = (key: CategoryKey) => {
      setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    };

    const generate = () => {
      const base = selected.length ? selected : (["運動", "学習"] as CategoryKey[]);
      const plans = buildWeekPlan(base);
      const next: AppState = {
        selectedCategories: base as CategoryKey[],
        plans,
        createdAt: new Date().toISOString(),
      };
      setState(next);
      saveState(next);
      setTab("クエスト");
    };

    return (
      <main className="mx-auto max-w-screen-sm p-4 text-black">
        <h1 className="text-xl font-semibold mb-4">どんな分野を伸ばしたい？</h1>
        <p className="text-sm text-neutral-600 mb-3">3つ前後選ぶのがおすすめ（後で変更できます）</p>
        <div className="grid grid-cols-3 gap-3">
          {ALL_CATEGORIES.map((c) => {
            const active = selected.includes(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleCategory(c.key)}
                className={`rounded-2xl border p-4 text-sm shadow-sm transition ${active ? "bg-rose-100 border-rose-300" : "bg-white border-neutral-200 hover:bg-neutral-50"}`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={generate} className="rounded-xl bg-rose-500 px-4 py-2 text-white shadow">7日間プランを作成</button>
          <button onClick={() => setSelected([])} className="text-sm text-neutral-600 underline underline-offset-4">選択をクリア</button>
        </div>

        <FooterNav current={tab} onChange={setTab} disabled />
      </main>
    );
  }

  /** 通常画面（ホーム/クエスト/チャット/設定） */
  return (
    <div>
      {/* 左上のメニューボタン */}
      <button
        onClick={toggleMenu}
       className={`fixed top-4 left-4 z-20 rounded-full bg-rose-500 p-3 text-white shadow-lg transition-opacity ${
    menuOpen ? "opacity-50" : "opacity-100"
  }`}
      >
        ☰
      </button>

      {/* オーバーレイ */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)} // オーバーレイをクリックでメニューを閉じる
          className="fixed inset-0 z-10 bg-black/50"
        ></div>
      )}

      {/* メニュー */}
      {menuOpen && (
        <div className="fixed top-0 left-0 z-10 w-64 h-full bg-white shadow-lg">
          <h2 className="text-lg font-semibold p-4 border-b">メニュー</h2>
          <ul className="space-y-2 p-4">
            {["ホーム", "クエスト", "チャット", "設定"].map((item) => (
              <li key={item}>
                <button
                  onClick={() => {
                    setTab(item as Tab);
                    setMenuOpen(false); // メニューを閉じる
                  }}
                  className={`block w-full text-left px-4 py-2 rounded-lg ${
                    tab === item ? "bg-rose-100 text-rose-600" : "hover:bg-neutral-100"
                  }`}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* メインコンテンツ */}
      <main className="mx-auto max-w-screen-sm p-4 text-black">
        {tab === "ホーム" && state?.plans && (
          <HomeView todayPlan={state.plans[todayIndex]} score={score} onRandom={() => setTab("クエスト")} />
        )}

        {tab === "クエスト" && state && (
          <QuestView
            plans={state.plans}
            todayIndex={todayIndex}
            onToggleDone={toggleDone}
            onToggleEnabled={toggleEnabled}
          />
        )}

        {tab === "チャット" && <ChatView />}

        {tab === "設定" && (
          <SettingsView
            onReset={resetAll}
            theme={state.theme ?? DEFAULT_THEME}
            onThemeChange={(theme) => {
              setState((prev) => (prev ? { ...prev, theme } : null));
              if (state) saveState({ ...state, theme });
            }}
          />
        )}
      </main>
    </div>
  );
}

/** -----------------------------
 *  ビュー：ホーム（既存）
 *  ----------------------------*/
function HomeView({ todayPlan, score, onRandom }: { todayPlan: DayPlan; score: number; onRandom: () => void }) {
  const enabled = todayPlan.quests.filter((q) => q.enabled);
  const doneCount = enabled.filter((q) => q.done).length;

  const randomQuest = useMemo(() => {
    if (!enabled.length) return null;
    return enabled[Math.floor(Math.random() * enabled.length)];
  }, [todayPlan]);

  return (
  <section className="space-y-4">
    <h1 className="text-xl font-semibold">ホーム（ダッシュボード）</h1>

    {/* 現在のスコアとランク */}
    <div className="rounded-2xl bg-white p-4 shadow-sm border">
      <div className="text-sm text-neutral-500 mb-2">現在のスコア</div>
      <div className="text-3xl font-bold">{score}</div>
      <div className="text-sm text-neutral-500 mt-2">ランク: {calculateRank(score)}</div>
    </div>

    {/* 今日の目標達成度 */}
    <div className="rounded-2xl bg-white p-4 shadow-sm border">
      <div className="text-sm text-neutral-500 mb-2">今日の目標達成度</div>
      <div className="text-3xl font-bold">
        {doneCount} / {enabled.length}
      </div>
    </div>

    {/* ランダムクエスト */}
    <div className="rounded-2xl bg-white p-4 shadow-sm border">
      <div className="text-sm text-neutral-500 mb-2">ランダムクエスト</div>
      {randomQuest ? (
        <div className="flex items-center justify-between">
          <div className="font-medium">{randomQuest.title}</div>
          <button
            onClick={onRandom}
            className="rounded-xl bg-rose-500 px-3 py-1.5 text-white"
          >
            やってみる
          </button>
        </div>
      ) : (
        <div className="text-neutral-500">有効なクエストがありません</div>
      )}
    </div>
  </section>
);
}

/** -----------------------------
 *  ビュー：クエスト（既存）
 *  ----------------------------*/
function QuestView({
  plans,
  todayIndex,
  onToggleDone,
  onToggleEnabled,
}: {
  plans: DayPlan[];
  todayIndex: number;
  onToggleDone: (dayIdx: number, qid: string) => void;
  onToggleEnabled: (dayIdx: number, qid: string) => void;
}) {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">クエスト</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {plans.map((p, idx) => (
          <div
            key={p.day}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${idx === todayIndex ? "border-rose-400" : "border-neutral-200"}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">Day {p.day}</div>
              {idx === todayIndex && <span className="text-xs text-rose-600">今日</span>}
            </div>
            <ul className="space-y-2">
              {p.quests.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={q.done}
                      disabled={!q.enabled}
                      onChange={() => onToggleDone(idx, q.id)}
                      className="h-4 w-4"
                    />
                    <span className={q.enabled ? "" : "line-through text-neutral-400"}>{q.title}</span>
                  </label>
                  <button
                    onClick={() => onToggleEnabled(idx, q.id)}
                    className={`rounded-lg px-2 py-1 text-xs border ${q.enabled ? "bg-emerald-50 border-emerald-200" : "bg-neutral-100 border-neutral-200"}`}
                    title="ON/OFF"
                  >
                    {q.enabled ? "ON" : "OFF"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** -----------------------------
 *  NEW: ビュー：チャット（模擬ChatGPT）
 *  ----------------------------*/
function ChatView() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "River Agentです。何から始める？" },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // 既存のChatBarを使うため、表示用に string[] に変換
  const displayLines = messages.map((m) => (m.role === "user" ? `あなた: ${m.content}` : `アシスタント: ${m.content}`));

  const handleSubmit = (text: string) => {
    const userMsg: ChatMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // 簡易モック応答
    const reply = mockAssistant(text, messages);
    // タイピング演出
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setIsTyping(false);
    }, Math.min(1200, Math.max(300, reply.length * 30))); // 長さに応じて待機
  };

  const resetChat = () => {
    setMessages([{ role: "assistant", content: "新しいチャットを始めよう。目標は？" }]);
  };

  return (
    <section className="space-y-4 my-2">
      <h1 className="text-xl font-semibold">チャット</h1>

      {/* バブルUI（直近10件） */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm h-80 overflow-y-auto space-y-3">
        {messages.slice(-10).map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow ${m.role === "user" ? "ml-auto bg-rose-500 text-white" : "mr-auto bg-neutral-100"}`}>
            {m.content}
          </div>
        ))}
        {isTyping && (
          <div className="mr-auto max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-neutral-100 shadow">
            <span className="inline-block animate-pulse">…考え中</span>
          </div>
        )}
      </div>

      {/* 既存のチャットバー（ログ全体のテキスト表示にも活用可能） */}
      <MessageInput onSubmit={handleSubmit} />

      <div className="flex justify-end">
        <button onClick={resetChat} className="text-xs underline text-neutral-600 underline-offset-4">チャットをリセット</button>
      </div>
    </section>
  );
}

/** シンプルなモック応答ロジック */
function mockAssistant(input: string, history: ChatMsg[]): string {
  const text = input.trim();
  const lower = text.toLowerCase();

  // 1) ルールベースの簡易応答
  if (/^help|^ヘルプ|困った|どう使/.test(text)) {
    return "使い方: 目標や悩みを書いて。小さく分解したタスク案を返すよ。例: ‘英単語を覚えたい’";
  }
  if (/こんにちは|初めまして|こんちは/.test(text)) {
    return "こんにちは。今日は何を進める？7分で出来る小タスクからいこう";
  }
  if (/天気|weather/.test(lower)) {
    return "天気はこのモックでは見られないけど、代わりに ‘屋内で出来ること’ を3つ提案: 1) ストレッチ7分 2) 読書10分 3) 机の片付け5分";
  }

  // 2) 目標→タスク分解（簡易）
  if (/英単語|単語|英語/.test(text)) {
    return "提案: 1) 1分で復習テーマ決め 2) 7分で10語暗記 3) 2分で自己テスト → 合計10分";
  }
  if (/運動|筋トレ|ストレッチ|走/.test(text)) {
    return "提案: 1) 1分準備 2) 7分サーキット(腕立て/スクワット/プランク) 3) 2分整理";
  }

  // 3) 質問らしい文には相槌＋要約
  if (/[?？]$/.test(text)) {
    const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
    return `要するに『${lastUser.slice(0, 40)}』ってことかな。まずは小さく試すと良いよ`;
  }

  // 4) デフォルト応答（共感＋次アクション）
  const len = text.length;
  const n = Math.max(3, Math.min(5, Math.floor(len / 12)));
  const tips = [
    "タイマーを10分セット",
    "やることを3つに絞る",
    "終わったら一言日記",
    "水を一杯飲む",
    "机の上を15秒だけ整える",
  ];
  const pick = shuffle(tips).slice(0, n).join(" / ");
  return `なるほど。いまから出来る小さな一歩: ${pick}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** -----------------------------
 *  既存：設定ビュー & フッター & ChatBar コンポーネント
 *  （あなたの元ファイルから流用可能。ここでは省略せず同梱）
 *  ----------------------------*/
function SettingsView({ onReset, theme, onThemeChange }: { onReset: () => void; theme: Theme; onThemeChange: (theme: Theme) => void }) {
  const handleBackgroundColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onThemeChange({ ...theme, backgroundColor: e.target.value });
  };
  const handleTextColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onThemeChange({ ...theme, textColor: e.target.value });
  };
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">設定</h1>
      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="text-sm text-neutral-600">進行中のクエストをリセットして最初から始めます。ランクは失われません。</div>
        <button onClick={onReset} className="rounded-xl bg-neutral-900 px-4 py-2 text-white">冒険をリセット</button>
      </div>
    </section>
  );
}

function FooterNav({ current, onChange, disabled = false }: { current: Tab; onChange: (t: Tab) => void; disabled?: boolean }) {
  const items: Tab[] = ["ホーム", "クエスト", "チャット", "設定"];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-screen-sm border-t bg-white/95 backdrop-blur">
      <ul className="flex items-stretch justify-around">
        {items.map((t) => {
          const active = current === t;
          return (
            <li key={t} className="flex-1">
              <button
                disabled={disabled}
                onClick={() => onChange(t)}
                className={`w-full py-3 text-sm transition ${active ? "text-rose-600 font-medium" : "text-neutral-600"} ${disabled ? "opacity-50" : ""}`}
              >
                {t}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MessageInput({ onSubmit }: { onSubmit: (message: string) => void }) {
  const [input, setInput] = useState("");
  const handleSend = () => {
    if (!input.trim()) return;
    onSubmit(input);
    setInput("");
  };
  return (
    <div className="flex items-center space-x-2 my-4">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="メッセージを入力..."
        className="flex-1 rounded-lg border px-3 py-2 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSend();
        }}
      />
      <button onClick={handleSend} className="rounded-lg bg-rose-500 px-4 py-2 text-white">
        送信
      </button>
    </div>
  );
}

function ChatBar({ messages, onSubmit }: { messages: string[]; onSubmit: (message: string) => void }) {
  const [input, setInput] = useState("");
  const handleSend = () => {
    if (!input.trim()) return;
    onSubmit(input);
    setInput("");
  };
  return (
    <section className="space-y-4 my-4">
      <h2 className="text-lg font-semibold">チャット</h2>
      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-2 h-48 overflow-y-auto">
        {messages.length > 0 ? (
          messages.map((msg, idx) => (
            <div key={idx} className="text-sm">{msg}</div>
          ))
        ) : (
          <div className="text-sm text-neutral-500">メッセージはありません。</div>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力..."
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <button onClick={handleSend} className="rounded-lg bg-rose-500 px-4 py-2 text-white">
          送信
        </button>
      </div>
    </section>
  );
}
