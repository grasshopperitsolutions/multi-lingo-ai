import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, AlertCircle, RotateCcw } from "lucide-react";
import AccentBar from "./AccentBar";
import { PrimaryButton } from "../ui";
import {
  VERDICT,
  checkTypedAnswer,
  checkSelection,
  acceptedAnswersFor,
  normalizeAnswer,
} from "../../utils/grammarAnswerCheck";

/**
 * One Grammar Practice item, answered and marked on the spot.
 *
 * One at a time rather than the exams' whole-sheet layout: this is practice,
 * and a mistake is worth most while the sentence is still on screen. The
 * explanation shows straight after marking.
 */

const TYPED = new Set(["conjugate", "conjugate-contrast", "gap-by-cue", "inflect"]);

/** Sentence with ___ drawn as a blank and [[words]] in bold. */
export function RichPrompt({ text, isDarkMode, blank = "…" }) {
  const parts = String(text ?? "").split(/(_{3,}|\[\[[^\]]+\]\])/g).filter((part) => part !== "");
  return (
    <span>
      {parts.map((part, i) => {
        if (/^_{3,}$/.test(part)) {
          return (
            <span
              key={i}
              className={`inline-block min-w-[3.5rem] mx-1 px-2 border-b-4 text-center ${
                isDarkMode ? "border-amber-400 text-amber-300" : "border-amber-500 text-amber-700"
              }`}
            >
              {blank}
            </span>
          );
        }
        if (part.startsWith("[[")) {
          return <strong key={i} className="underline decoration-amber-500 decoration-2">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
RichPrompt.propTypes = { text: PropTypes.string, isDarkMode: PropTypes.bool.isRequired, blank: PropTypes.string };

const choiceClasses = (isDarkMode, { selected = false, state = null } = {}) => {
  const base = "px-4 py-2.5 rounded-xl border-4 font-bold text-left transition-all disabled:cursor-default";
  if (state === "right") return `${base} ${isDarkMode ? "bg-emerald-900/40 border-emerald-500 text-emerald-200" : "bg-emerald-50 border-emerald-500 text-emerald-900"}`;
  if (state === "wrong") return `${base} ${isDarkMode ? "bg-rose-900/40 border-rose-500 text-rose-200" : "bg-rose-50 border-rose-500 text-rose-900"}`;
  if (selected) return `${base} ${isDarkMode ? "bg-amber-900/40 border-amber-400 text-white" : "bg-amber-50 border-amber-500 text-slate-900"}`;
  return `${base} ${isDarkMode ? "bg-slate-800 border-slate-600 text-slate-100 hover:border-amber-400" : "bg-white border-slate-900 text-slate-900 hover:border-amber-500"}`;
};

const PracticeItem = ({ type, item, exercise, dialect, isDarkMode, result, onResult }) => {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState([]);
  const [judgement, setJudgement] = useState(null); // null | true | false
  const answered = Boolean(result);

  // A new item starts clean.
  useEffect(() => {
    setText("");
    setPicked([]);
    setJudgement(null);
  }, [item.id]);

  useEffect(() => {
    if (!answered && (TYPED.has(type) || judgement === false)) inputRef.current?.focus();
  }, [item.id, type, judgement, answered]);

  const accepted = acceptedAnswersFor(item);

  const submitTyped = (value) => {
    if (!normalizeAnswer(value)) return;
    const { verdict } = checkTypedAnswer(value, accepted);
    onResult({ verdict, given: value });
  };

  const submitChoice = (value) => {
    const { verdict } = checkTypedAnswer(value, accepted);
    onResult({ verdict: verdict === VERDICT.CORRECT ? VERDICT.CORRECT : VERDICT.WRONG, given: value });
  };

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-semibold text-lg outline-none transition-colors ${
    isDarkMode
      ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-amber-400"
      : "bg-white border-slate-900 text-slate-900 placeholder-slate-400 focus:border-amber-500"
  }`;
  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";
  const body = isDarkMode ? "text-slate-100" : "text-slate-900";

  const typedInput = (onSubmit) => (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        id={`practice-answer-${item.id}`}
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={text}
        disabled={answered}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !answered) onSubmit(text); }}
        placeholder={t("grammar_practice.answer_placeholder")}
        aria-label={t("grammar_practice.answer_placeholder")}
        className={inputClasses}
      />
      {!answered && (
        <>
          <AccentBar dialect={dialect} inputRef={inputRef} value={text} onChange={setText} isDarkMode={isDarkMode} />
          <PrimaryButton onClick={() => onSubmit(text)} disabled={!normalizeAnswer(text)} isDarkMode={isDarkMode} color="amber" className="self-start">
            {t("grammar_practice.check")}
          </PrimaryButton>
        </>
      )}
    </div>
  );

  const cueChips = (
    <div className="flex flex-wrap gap-2">
      {item.cue && (
        <span className={`px-3 py-1 rounded-full border-2 text-sm font-black ${isDarkMode ? "border-amber-400 text-amber-300" : "border-amber-500 text-amber-700"}`}>
          {item.cue}
        </span>
      )}
      {item.cueLabel && (
        <span className={`px-3 py-1 rounded-full border-2 text-sm font-bold ${isDarkMode ? "border-slate-600 text-slate-300" : "border-slate-300 text-slate-600"}`}>
          {item.cueLabel}
        </span>
      )}
    </div>
  );

  const optionState = (option) => {
    if (!answered) return null;
    const isAnswer = accepted.some((a) => normalizeAnswer(a) === normalizeAnswer(option));
    const wasPicked = (Array.isArray(result.given) ? result.given : [result.given])
      .some((g) => normalizeAnswer(g) === normalizeAnswer(option));
    if (isAnswer) return "right";
    if (wasPicked) return "wrong";
    return null;
  };

  let task = null;

  if (TYPED.has(type)) {
    task = (
      <>
        <p className={`text-xl font-bold leading-relaxed ${body}`}>
          {type === "inflect" ? item.prompt : <RichPrompt text={item.prompt} isDarkMode={isDarkMode} />}
        </p>
        {cueChips}
        {typedInput(submitTyped)}
      </>
    );
  } else if (type === "choose-option") {
    task = (
      <>
        <p className={`text-xl font-bold leading-relaxed ${body}`}><RichPrompt text={item.prompt} isDarkMode={isDarkMode} /></p>
        <div className="grid gap-2 sm:grid-cols-2">
          {item.options.map((option) => (
            <button key={option} type="button" disabled={answered} onClick={() => submitChoice(option)}
              className={choiceClasses(isDarkMode, { state: optionState(option) })}>
              {option}
            </button>
          ))}
        </div>
      </>
    );
  } else if (type === "classify") {
    task = (
      <>
        <p className={`text-xl font-bold leading-relaxed ${body}`}><RichPrompt text={item.prompt} isDarkMode={isDarkMode} /></p>
        <div className="flex flex-wrap gap-2">
          {(exercise.labels ?? []).map((label) => (
            <button key={label} type="button" disabled={answered} onClick={() => submitChoice(label)}
              className={choiceClasses(isDarkMode, { state: optionState(label) })}>
              {label}
            </button>
          ))}
        </div>
      </>
    );
  } else if (type === "multi-select") {
    const toggle = (option) =>
      setPicked((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
    task = (
      <>
        <p className={`text-xl font-bold leading-relaxed ${body}`}>“{item.source}”</p>
        <p className={`text-sm font-semibold ${muted}`}>{t("grammar_practice.pick_all")}</p>
        <div className="grid gap-2">
          {item.options.map((option) => (
            <button key={option} type="button" disabled={answered} aria-pressed={picked.includes(option)}
              onClick={() => toggle(option)}
              className={choiceClasses(isDarkMode, { selected: picked.includes(option), state: optionState(option) })}>
              {option}
            </button>
          ))}
        </div>
        {!answered && (
          <PrimaryButton onClick={() => onResult({ verdict: checkSelection(picked, accepted) ? VERDICT.CORRECT : VERDICT.WRONG, given: picked })}
            disabled={picked.length === 0} isDarkMode={isDarkMode} color="amber" className="self-start">
            {t("grammar_practice.check")}
          </PrimaryButton>
        )}
      </>
    );
  } else if (type === "judge-correct") {
    const judge = (value) => {
      setJudgement(value);
      // Saying "correct" is the whole answer; "incorrect" needs the fix too.
      if (value === true) onResult({ verdict: item.isCorrect ? VERDICT.CORRECT : VERDICT.WRONG, given: t("grammar_practice.judge_correct") });
      else if (item.isCorrect) onResult({ verdict: VERDICT.WRONG, given: t("grammar_practice.judge_incorrect") });
    };
    task = (
      <>
        <p className={`text-xl font-bold leading-relaxed ${body}`}>{item.prompt}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={answered || judgement !== null} onClick={() => judge(true)}
            className={choiceClasses(isDarkMode, { selected: judgement === true })}>
            {t("grammar_practice.judge_correct")}
          </button>
          <button type="button" disabled={answered || judgement !== null} onClick={() => judge(false)}
            className={choiceClasses(isDarkMode, { selected: judgement === false })}>
            {t("grammar_practice.judge_incorrect")}
          </button>
        </div>
        {judgement === false && !item.isCorrect && (
          <>
            <p className={`text-sm font-semibold ${muted}`}>{t("grammar_practice.fix_it")}</p>
            {typedInput(submitTyped)}
          </>
        )}
      </>
    );
  } else if (type === "word-order") {
    const remaining = item.fragments.map((f, i) => ({ f, i })).filter(({ i }) => !picked.includes(i));
    const sentence = picked.map((i) => item.fragments[i]).join(" ");
    task = (
      <>
        <div className={`min-h-[3.5rem] px-4 py-3 rounded-xl border-4 border-dashed text-lg font-bold ${
          isDarkMode ? "border-slate-600 text-white" : "border-slate-400 text-slate-900"}`}>
          {sentence || <span className={muted}>{t("grammar_practice.tap_fragments")}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {remaining.map(({ f, i }) => (
            <button key={i} type="button" disabled={answered} onClick={() => setPicked((prev) => [...prev, i])}
              className={choiceClasses(isDarkMode)}>
              {f}
            </button>
          ))}
        </div>
        {!answered && (
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => submitTyped(sentence)} disabled={remaining.length > 0}
              isDarkMode={isDarkMode} color="amber">
              {t("grammar_practice.check")}
            </PrimaryButton>
            <button type="button" onClick={() => setPicked([])}
              className={`inline-flex items-center gap-1.5 px-3 font-bold text-sm ${muted}`}>
              <RotateCcw size={14} /> {t("grammar_practice.start_over")}
            </button>
          </div>
        )}
      </>
    );
  } else if (type === "fill-from-bank") {
    // The whole passage stays in view; the gap being answered is marked.
    const passageParts = String(exercise.passage ?? "").split(/(_{3,})/g);
    // Gap number for each part: odd indices of the split are the gaps.
    const gapNumber = (i) => (i + 1) / 2;
    task = (
      <>
        <p className={`text-lg font-semibold leading-relaxed ${body}`}>
          {passageParts.map((part, i) => {
            if (!/^_{3,}$/.test(part)) return <span key={i}>{part}</span>;
            const gapIndex = gapNumber(i);
            const isCurrent = gapIndex === item.position;
            return (
              <span key={i} className={`inline-block mx-1 px-2 rounded border-b-4 font-black ${
                isCurrent
                  ? isDarkMode ? "bg-amber-900/40 border-amber-400 text-amber-200" : "bg-amber-100 border-amber-500 text-amber-800"
                  : isDarkMode ? "border-slate-600 text-slate-500" : "border-slate-300 text-slate-400"
              }`}>
                {gapIndex}
              </span>
            );
          })}
        </p>
        <div className="flex flex-wrap gap-2">
          {(exercise.wordBank ?? []).map((word) => (
            <button key={word} type="button" disabled={answered} onClick={() => submitChoice(word)}
              className={choiceClasses(isDarkMode, { state: optionState(word) })}>
              {word}
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {task}
      {answered && <ResultPanel result={result} item={item} isDarkMode={isDarkMode} />}
    </div>
  );
};

const ResultPanel = ({ result, item, isDarkMode }) => {
  const { t } = useTranslation();
  const tone = {
    [VERDICT.CORRECT]: {
      icon: CheckCircle2,
      title: t("grammar_practice.result_correct"),
      classes: isDarkMode ? "bg-emerald-900/30 border-emerald-600 text-emerald-100" : "bg-emerald-50 border-emerald-500 text-emerald-900",
    },
    [VERDICT.ACCENT]: {
      icon: AlertCircle,
      title: t("grammar_practice.result_accent"),
      classes: isDarkMode ? "bg-amber-900/30 border-amber-500 text-amber-100" : "bg-amber-50 border-amber-500 text-amber-900",
    },
    [VERDICT.WRONG]: {
      icon: XCircle,
      title: t("grammar_practice.result_wrong"),
      classes: isDarkMode ? "bg-rose-900/30 border-rose-600 text-rose-100" : "bg-rose-50 border-rose-500 text-rose-900",
    },
  }[result.verdict];
  const Icon = tone.icon;
  // A sentence that was already right has no correction to show: show it.
  const answers = item.isCorrect === true ? [item.prompt] : (item.answers ?? []);

  return (
    <div className={`rounded-xl border-4 p-4 flex flex-col gap-2 ${tone.classes}`} role="status">
      <p className="flex items-center gap-2 font-black"><Icon size={18} /> {tone.title}</p>
      {result.verdict !== VERDICT.CORRECT && answers.length > 0 && (
        <p className="font-bold">
          {t("grammar_practice.correct_answer")}: <span className="font-black">{answers.join(" · ")}</span>
        </p>
      )}
      {item.explanation && <p className="text-sm font-semibold opacity-90">{item.explanation}</p>}
    </div>
  );
};
ResultPanel.propTypes = {
  result: PropTypes.shape({ verdict: PropTypes.string.isRequired }).isRequired,
  item: PropTypes.object.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

PracticeItem.propTypes = {
  type: PropTypes.string.isRequired,
  item: PropTypes.object.isRequired,
  exercise: PropTypes.object.isRequired,
  dialect: PropTypes.string,
  isDarkMode: PropTypes.bool.isRequired,
  result: PropTypes.shape({ verdict: PropTypes.string, given: PropTypes.any }),
  onResult: PropTypes.func.isRequired,
};

export default PracticeItem;
