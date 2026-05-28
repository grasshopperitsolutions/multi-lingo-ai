/**
 * WritingExercise.jsx
 *
 * Full 3-step writing exercise flow for the Exam Training feature.
 *
 * Steps:
 *   1. Setup  — select CEFR level, click "Get Exercise"
 *   2. Writing — read prompt + instructions, use timer, write text
 *   3. Results — score out of 25, per-parameter breakdown (A–E), general feedback
 *
 * Changes in this version:
 *   - Replaced direct generateWritingPrompt() call with getExercise() so that
 *     exercises are fetched from the shared Firestore pool first, and only
 *     generated via AI when the pool is exhausted for this user.
 *   - uid is now read from AppContext (no prop needed).
 */

import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, RefreshCw, Loader2 } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import ExamTimer from './ExamTimer';
import {
  getExercise,
  evaluateWriting,
} from '../services/examTrainingService';

// CEFR levels
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Steps
const STEP_SETUP   = 'setup';
const STEP_WRITING = 'writing';
const STEP_RESULTS = 'results';

// ── Sub-components ────────────────────────────────────────────────────────

function ParameterRow({ param, isDarkMode }) {
  const pct = Math.round((param.score / param.maxScore) * 100);
  const color =
    pct >= 80 ? 'var(--color-success)'
    : pct >= 50 ? 'var(--color-gold)'
    : 'var(--color-error)';

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: isDarkMode ? 'var(--color-text)' : 'var(--color-text)' }}>
          {param.id}. {param.name}
        </span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {param.score}/{param.maxScore}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-surface-offset)', overflow: 'hidden', marginBottom: 'var(--space-1)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
      </div>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>{param.feedback}</p>
    </div>
  );
}

ParameterRow.propTypes = {
  param:      PropTypes.object.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ── Main component ─────────────────────────────────────────────────────────

export default function WritingExercise({ onBack }) {
  const { t }                       = useTranslation();
  const { user, isDarkMode }        = useAppContext();

  const [step, setStep]             = useState(STEP_SETUP);
  const [selectedLevel, setSelectedLevel] = useState('B1');
  const [exercise, setExercise]     = useState(null);   // ExerciseDoc from pool or AI
  const [userText, setUserText]     = useState('');
  const [results, setResults]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  const timerRef = useRef(null);

  // ── Word count helpers ──
  const wordCount  = userText.trim() ? userText.trim().split(/\s+/).filter(Boolean).length : 0;
  const minWords   = exercise?.minWords ?? 0;
  const maxWords   = exercise?.maxWords ?? 0;
  const inRange    = wordCount >= minWords && wordCount <= maxWords;
  const wcColor    = wordCount === 0
    ? 'var(--color-text-faint)'
    : inRange
    ? 'var(--color-success)'
    : 'var(--color-error)';

  // ── Handlers ──

  const handleGetExercise = async () => {
    setError(null);
    setLoading(true);
    try {
      const doc = await getExercise({
        token:        user.token,
        uid:          user.uid,
        level:        selectedLevel,
        exerciseType: 'writing',
        lang:         user.learningDialect ?? 'pt-PT',
      });
      setExercise(doc);
      setUserText('');
      setResults(null);
      setStep(STEP_WRITING);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!userText.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await evaluateWriting({
        token:         user.token,
        level:         selectedLevel,
        exercisePrompt: exercise.prompt,
        userText,
      });
      setResults(res);
      setStep(STEP_RESULTS);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTryAgain = () => {
    setStep(STEP_SETUP);
    setExercise(null);
    setUserText('');
    setResults(null);
    setError(null);
    if (timerRef.current) timerRef.current.reset();
  };

  // ── Shared card style ──
  const card = {
    background:   'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    border:       '1px solid var(--color-border)',
    padding:      'var(--space-6)',
    boxShadow:    'var(--shadow-sm)',
  };

  // ════════════════════════════════════════
  // STEP: Setup
  // ════════════════════════════════════════
  if (step === STEP_SETUP) {
    return (
      <div>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <ChevronLeft size={16} />
          {t('exam.title')}
        </button>

        <div style={card}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            {t('exam.writing')}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
            {t('exam.language_note')}
          </p>

          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            {t('exam.select_level')}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                style={{
                  padding:      'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border:       `1px solid ${selectedLevel === lvl ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background:   selectedLevel === lvl ? 'var(--color-primary)' : 'transparent',
                  color:        selectedLevel === lvl ? '#fff' : 'var(--color-text)',
                  fontWeight:   selectedLevel === lvl ? 700 : 400,
                  fontSize:     'var(--text-sm)',
                  cursor:       'pointer',
                  transition:   'all var(--transition-interactive)',
                }}
              >
                {lvl}
              </button>
            ))}
          </div>

          {error && (
            <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>{error}</p>
          )}

          <button
            onClick={handleGetExercise}
            disabled={loading}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          'var(--space-2)',
              padding:      'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-md)',
              background:   'var(--color-primary)',
              color:        '#fff',
              fontWeight:   600,
              fontSize:     'var(--text-sm)',
              border:       'none',
              cursor:       loading ? 'not-allowed' : 'pointer',
              opacity:      loading ? 0.7 : 1,
              transition:   'all var(--transition-interactive)',
            }}
          >
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {loading ? t('exam.generating') : t('exam.get_exercise')}
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════
  // STEP: Writing
  // ════════════════════════════════════════
  if (step === STEP_WRITING) {
    return (
      <div>
        <button
          onClick={() => setStep(STEP_SETUP)}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <ChevronLeft size={16} />
          {t('exam.select_level')}
        </button>

        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {/* Task card */}
          <div style={card}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
              {t('exam.task')} <span style={{ color: 'var(--color-primary)', marginLeft: 'var(--space-2)' }}>{selectedLevel}</span>
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', marginBottom: 'var(--space-4)', lineHeight: 1.7 }}>
              {exercise.prompt}
            </p>
            <ul style={{ paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {exercise.instructions.map((ins, i) => (
                <li key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{ins}</li>
              ))}
            </ul>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', marginTop: 'var(--space-3)' }}>
              {t('exam.word_count_target', { min: exercise.minWords, max: exercise.maxWords })}
            </p>
          </div>

          {/* Timer */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{t('exam.timer')}</span>
            <ExamTimer ref={timerRef} />
          </div>

          {/* Writing area */}
          <div style={card}>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              {t('exam.your_text')}
            </label>
            <textarea
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              rows={10}
              placeholder={t('exam.textarea_placeholder')}
              style={{
                width:        '100%',
                borderRadius: 'var(--radius-md)',
                border:       '1px solid var(--color-border)',
                background:   'var(--color-surface-2)',
                color:        'var(--color-text)',
                padding:      'var(--space-3)',
                fontSize:     'var(--text-base)',
                lineHeight:   1.7,
                resize:       'vertical',
                outline:      'none',
                fontFamily:   'inherit',
              }}
            />
            <p style={{ fontSize: 'var(--text-xs)', color: wcColor, marginTop: 'var(--space-1)', textAlign: 'right' }}>
              {wordCount} {t('exam.words')}
              {wordCount > 0 && !inRange && ` · ${
                wordCount < minWords ? t('exam.too_short') : t('exam.too_long')
              }`}
            </p>
          </div>

          {error && (
            <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>
          )}

          <button
            onClick={handleEvaluate}
            disabled={loading || wordCount === 0}
            style={{
              padding:      'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-md)',
              background:   'var(--color-primary)',
              color:        '#fff',
              fontWeight:   600,
              fontSize:     'var(--text-sm)',
              border:       'none',
              cursor:       (loading || wordCount === 0) ? 'not-allowed' : 'pointer',
              opacity:      (loading || wordCount === 0) ? 0.7 : 1,
              display:      'flex',
              alignItems:   'center',
              gap:          'var(--space-2)',
              transition:   'all var(--transition-interactive)',
            }}
          >
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {loading ? t('exam.evaluating') : t('exam.evaluate')}
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════
  // STEP: Results
  // ════════════════════════════════════════
  const scorePct  = results ? Math.round((results.totalScore / results.maxScore) * 100) : 0;
  const scoreColor =
    scorePct >= 80 ? 'var(--color-success)'
    : scorePct >= 50 ? 'var(--color-gold)'
    : 'var(--color-error)';

  return (
    <div>
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        {/* Score card */}
        <div style={{ ...card, textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
            {t('exam.results')} · {selectedLevel}
          </p>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
            {results.totalScore}<span style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)', fontWeight: 400 }}>/{results.maxScore}</span>
          </div>
          {results.wordCountPenalty > 0 && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)', marginTop: 'var(--space-1)' }}>
              {t('exam.penalty', { n: results.wordCountPenalty })}
            </p>
          )}
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', marginTop: 'var(--space-1)' }}>
            {t('exam.word_count')}: {results.wordCount}
          </p>
        </div>

        {/* Parameter breakdown */}
        <div style={card}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            {t('exam.breakdown')}
          </h3>
          {results.parameters.map((p) => (
            <ParameterRow key={p.id} param={p} isDarkMode={isDarkMode} />
          ))}
        </div>

        {/* General feedback */}
        {results.generalFeedback && (
          <div style={card}>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
              {t('exam.general_feedback')}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              {results.generalFeedback}
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button
            onClick={handleTryAgain}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          'var(--space-2)',
              padding:      'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-md)',
              background:   'var(--color-primary)',
              color:        '#fff',
              fontWeight:   600,
              fontSize:     'var(--text-sm)',
              border:       'none',
              cursor:       'pointer',
              transition:   'all var(--transition-interactive)',
            }}
          >
            <RefreshCw size={16} />
            {t('exam.try_again')}
          </button>

          {/* Coming soon */}
          <button
            disabled
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          'var(--space-2)',
              padding:      'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-md)',
              background:   'var(--color-surface-offset)',
              color:        'var(--color-text-faint)',
              fontWeight:   600,
              fontSize:     'var(--text-sm)',
              border:       '1px solid var(--color-border)',
              cursor:       'not-allowed',
            }}
          >
            {t('exam.improve')}
            <span style={{ fontSize: 'var(--text-xs)', background: 'var(--color-surface-dynamic)', borderRadius: 'var(--radius-full)', padding: '2px 8px', color: 'var(--color-text-muted)' }}>
              {t('challenges.coming_soon')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

WritingExercise.propTypes = {
  onBack: PropTypes.func.isRequired,
};
