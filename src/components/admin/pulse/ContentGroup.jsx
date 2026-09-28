import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  countByDay,
  dayKeyOf,
  formatBytes,
  inPeriod,
  stackByDay,
  sumArrayLengths,
  sumSeenExercisesByType,
  ttsSummary,
} from "../../../utils/pulseMetrics";
import { Chart, DailyBars, Grid, Group, SourceError, SplitChart, StackedDailyBars, Stat } from "./PulseCharts";

const TALE_SPLITS = {
  language: { label: "Language", key: (d) => d.targetLang },
  level: { label: "Level", key: (d) => d.level },
  theme: { label: "Theme", key: (d) => d.theme },
};

const EXAM_SPLITS = {
  type: { label: "Type", key: (d) => d.type },
  level: { label: "Level", key: (d) => d.level },
  language: { label: "Language", key: (d) => d.language },
};

const GRAMMAR_SPLITS = {
  type: { label: "Type", key: (d) => d.type },
  level: { label: "Level", key: (d) => d.level },
  language: { label: "Language", key: (d) => d.language },
};

const PASSAGE_SPLITS = {
  language: { label: "Language", key: (d) => d.targetLang },
  level: { label: "Level", key: (d) => d.level },
};

// Source is on each word's translation, a subcollection; whether the concept
// is tagged with an interest is on the top-level document, so that is the
// split Phase 2 can afford. Source waits for the Phase 3 snapshot.
const WORD_SPLITS = {
  topic: { label: "Tagged", key: (d) => (Array.isArray(d.topicIds) && d.topicIds.length ? "Interest-tagged" : "Untagged") },
  status: { label: "Status", key: (d) => d.status },
};

const CLIP_SPLITS = {
  voice: { label: "Voice", key: (d) => d.voice },
  language: { label: "Language", key: (d) => d.language },
};

/** The pooled content: what was generated, and how much of it was used. */
const ContentGroup = ({ pulse }) => {
  const { data, period, periodName, isDarkMode, langLabel, usersById } = pulse;
  const [split, setSplit] = useState({
    tales: "language", exams: "type", grammar: "type", passages: "language", words: "topic", clips: "voice",
  });
  const setSplitFor = (chart) => (id) => setSplit((s) => ({ ...s, [chart]: id }));
  const { errors } = data;

  const m = useMemo(() => {
    const { users } = data;
    const pool = (docs, splits, chosen) => ({
      inPeriod: inPeriod(docs, period).length,
      total: docs.length,
      stack: stackByDay(docs, period, splits[chosen].key),
    });
    const puzzles = [
      ...data.wordLinkGamePool.map((d) => ({ ...d, game: "Word Link" })),
      ...data.wordLadderGamePool.map((d) => ({ ...d, game: "Word Ladder" })),
    ];
    return {
      tales: { ...pool(data.stories, TALE_SPLITS, split.tales), reads: sumArrayLengths(users, "seenStoryIds") },
      culture: {
        inPeriod: inPeriod(data.historyFacts, period).length,
        total: data.historyFacts.length,
        reads: sumArrayLengths(users, "seenHistoryFactsIds"),
        byDay: countByDay(data.historyFacts, period),
      },
      exams: { ...pool(data.examExercises, EXAM_SPLITS, split.exams), completed: sumSeenExercisesByType(users) },
      passages: { ...pool(data.pronunciationPassages, PASSAGE_SPLITS, split.passages), used: sumArrayLengths(users, "seenPassageIds") },
      grammar: pool(data.grammarExercises, GRAMMAR_SPLITS, split.grammar),
      grammarTopics: {
        inPeriod: inPeriod(data.grammarTopics, period).length,
        total: data.grammarTopics.length,
        // Topics the model coins for Practice are stored as `practice` and
        // never shown in Structures; the rest are the curated library.
        practice: data.grammarTopics.filter((t) => t.status === "practice").length,
      },
      words: { ...pool(data.wordPool, WORD_SPLITS, split.words), met: sumArrayLengths(users, "seenConceptIds") },
      puzzles: {
        ...pool(puzzles, { game: { key: (d) => d.game } }, "game"), // one split, fixed
        linkTotal: data.wordLinkGamePool.length,
        ladderTotal: data.wordLadderGamePool.length,
        linkSolved: sumArrayLengths(users, "seenWordLinkPuzzleIds"),
        ladderSolved: sumArrayLengths(users, "seenWordLadderPuzzleIds"),
      },
      clips: { ...ttsSummary(data.ttsClips, period), stack: stackByDay(data.ttsClips, period, CLIP_SPLITS[split.clips].key) },
      localesAdded: inPeriod(data.locales, period).map((l) => l.id).sort(),
      languagesAdded: inPeriod(data.languages, period)
        .map((l) => ({
          code: l.code ?? l.id,
          label: l.label || l.code || l.id,
          day: dayKeyOf(l.createdAt),
          by: usersById[l.createdBy]
            ? usersById[l.createdBy].displayName || usersById[l.createdBy].email || l.createdBy
            : "Unknown or deleted user",
        }))
        .sort((a, b) => b.day.localeCompare(a.day)),
    };
  }, [data, period, split, usersById]);

  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";
  const examCompleted = Object.entries(m.exams.completed).sort((a, b) => b[1] - a[1]);
  const error = (key, name) => errors[key] && <SourceError name={name} message={errors[key]} isDarkMode={isDarkMode} />;

  return (
    <Group title="Content & AI" isDarkMode={isDarkMode}>
      <div className="space-y-3">
        <Grid>
          <Stat label={`Tales, ${periodName}`} value={m.tales.inPeriod} hint={`${m.tales.total} in the pool`} isDarkMode={isDarkMode} />
          <Stat label="Tales read" value={m.tales.reads} hint="All time" isDarkMode={isDarkMode} />
          <Stat
            label="Pool reuse"
            value={m.tales.total ? `${(m.tales.reads / m.tales.total).toFixed(1)}×` : "—"}
            hint="Reads per tale generated"
            isDarkMode={isDarkMode}
          />
        </Grid>
        <SplitChart
          title="Tales per day" splits={TALE_SPLITS} split={split.tales} onSplit={setSplitFor("tales")}
          stack={m.tales.stack} labelFor={split.tales === "language" ? langLabel : undefined} isDarkMode={isDarkMode}
        />
      </div>

      <div className="space-y-3">
        <Grid>
          <Stat label={`Culture pieces, ${periodName}`} value={m.culture.inPeriod} hint={`${m.culture.total} in the pool`} isDarkMode={isDarkMode} />
          <Stat label="Culture pieces read" value={m.culture.reads} hint="All time" isDarkMode={isDarkMode} />
        </Grid>
        <Chart title="Culture pieces per day" isDarkMode={isDarkMode}>
          <DailyBars data={m.culture.byDay} colour="bg-violet-500" isDarkMode={isDarkMode} />
        </Chart>
      </div>

      <div className="space-y-3">
        <Grid>
          <Stat label={`Exam exercises, ${periodName}`} value={m.exams.inPeriod} hint={`${m.exams.total} in the pool`} isDarkMode={isDarkMode} />
          {examCompleted.map(([type, count]) => (
            <Stat key={type} label={`${type} completed`} value={count} hint="All time" isDarkMode={isDarkMode} />
          ))}
        </Grid>
        <SplitChart
          title="Exam exercises per day" splits={EXAM_SPLITS} split={split.exams} onSplit={setSplitFor("exams")}
          stack={m.exams.stack} isDarkMode={isDarkMode}
        />
      </div>

      <div className="space-y-3">
        {error("grammarExercises", "grammar exercises")}
        {error("grammarTopics", "grammar topics")}
        <Grid>
          <Stat label={`Grammar exercises, ${periodName}`} value={m.grammar.inPeriod} hint={`${m.grammar.total} in the pool`} isDarkMode={isDarkMode} />
          <Stat label={`Grammar topics, ${periodName}`} value={m.grammarTopics.inPeriod} hint={`${m.grammarTopics.total} in all`} isDarkMode={isDarkMode} />
          <Stat label="Practice-only topics" value={m.grammarTopics.practice} hint="Coined by the model, not in Structures" isDarkMode={isDarkMode} />
        </Grid>
        <SplitChart
          title="Grammar exercises per day" splits={GRAMMAR_SPLITS} split={split.grammar} onSplit={setSplitFor("grammar")}
          stack={m.grammar.stack} isDarkMode={isDarkMode}
        />
      </div>

      <div className="space-y-3">
        {error("pronunciationPassages", "reading-aloud passages")}
        <Grid>
          <Stat label={`Reading-aloud passages, ${periodName}`} value={m.passages.inPeriod} hint={`${m.passages.total} in the pool`} isDarkMode={isDarkMode} />
          <Stat label="Passages used" value={m.passages.used} hint="All time" isDarkMode={isDarkMode} />
        </Grid>
        <SplitChart
          title="Passages per day" splits={PASSAGE_SPLITS} split={split.passages} onSplit={setSplitFor("passages")}
          stack={m.passages.stack} labelFor={split.passages === "language" ? langLabel : undefined} isDarkMode={isDarkMode}
        />
      </div>

      <div className="space-y-3">
        {error("wordPool", "the word pool")}
        <Grid>
          <Stat label={`Words added, ${periodName}`} value={m.words.inPeriod} hint={`${m.words.total} in the pool`} isDarkMode={isDarkMode} />
          <Stat label="Words met" value={m.words.met} hint="All time, across users" isDarkMode={isDarkMode} />
        </Grid>
        <SplitChart
          title="Word pool growth per day" splits={WORD_SPLITS} split={split.words} onSplit={setSplitFor("words")}
          stack={m.words.stack} isDarkMode={isDarkMode}
        />
      </div>

      <div className="space-y-3">
        {error("wordLinkGamePool", "Word Link puzzles")}
        {error("wordLadderGamePool", "Word Ladder puzzles")}
        <Grid>
          <Stat label={`Puzzles made, ${periodName}`} value={m.puzzles.inPeriod} isDarkMode={isDarkMode} />
          <Stat label="Word Link solved" value={m.puzzles.linkSolved} hint={`${m.puzzles.linkTotal} made in all`} isDarkMode={isDarkMode} />
          <Stat label="Word Ladder solved" value={m.puzzles.ladderSolved} hint={`${m.puzzles.ladderTotal} made in all`} isDarkMode={isDarkMode} />
        </Grid>
        <Chart title="Puzzles made per day, by game" isDarkMode={isDarkMode}>
          <StackedDailyBars stack={m.puzzles.stack} isDarkMode={isDarkMode} />
        </Chart>
      </div>

      <div className="space-y-3">
        {error("ttsClips", "speech clips")}
        <Grid>
          <Stat label={`Speech clips, ${periodName}`} value={m.clips.inPeriod} hint={`${formatBytes(m.clips.bytesInPeriod)} stored`} isDarkMode={isDarkMode} />
          <Stat label="Speech clips cached" value={m.clips.total} hint="All time" isDarkMode={isDarkMode} />
          <Stat label="Clip storage" value={formatBytes(m.clips.bytes)} hint="Base64 in Firestore" isDarkMode={isDarkMode} />
        </Grid>
        <SplitChart
          title="Speech clips per day" splits={CLIP_SPLITS} split={split.clips} onSplit={setSplitFor("clips")}
          stack={m.clips.stack} labelFor={split.clips === "language" ? langLabel : undefined} isDarkMode={isDarkMode}
        />
      </div>

      <Chart title={`Languages added, ${periodName} (${m.languagesAdded.length})`} isDarkMode={isDarkMode}>
        {m.languagesAdded.length === 0 ? (
          <p className={`text-sm font-bold ${muted}`}>None.</p>
        ) : (
          <ul className="space-y-1">
            {m.languagesAdded.map((l) => (
              <li key={l.code} className={`text-sm font-bold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                {l.label} <span className={muted}>({l.code}) · {l.day} · {l.by}</span>
              </li>
            ))}
          </ul>
        )}
      </Chart>

      <Chart title="Interface languages set up" isDarkMode={isDarkMode}>
        {error("locales", "locales")}
        <p className={`text-sm font-bold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
          {data.locales.length} translated locales, plus the bundled base.
          <span className={muted}>
            {" "}New, {periodName}: {m.localesAdded.length ? m.localesAdded.map(langLabel).join(", ") : "none"}.
          </span>
        </p>
      </Chart>
    </Group>
  );
};

ContentGroup.propTypes = { pulse: PropTypes.object.isRequired };

export default ContentGroup;
