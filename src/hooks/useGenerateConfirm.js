import { useState } from "react";

/**
 * useGenerateConfirm — manages a confirm dialog for generating a new exercise
 * when one is already in progress.
 *
 * @param {boolean} isOngoing - true when there's an active (unfinished) exercise
 * @returns {{
 *   showConfirm: boolean,
 *   onGenerateClick: (onGenerate: () => void) => void,
 *   handleConfirm: (cleanupAndGenerate: () => void) => void,
 *   handleCancel: () => void,
 * }}
 */
const useGenerateConfirm = (isOngoing) => {
  const [showConfirm, setShowConfirm] = useState(false);

  /**
   * Intercepts the generate button click.
   * If an exercise is ongoing, shows the confirm dialog first.
   * Otherwise, calls onGenerate immediately.
   */
  const onGenerateClick = (onGenerate) => {
    if (isOngoing) {
      setShowConfirm(true);
    } else {
      onGenerate();
    }
  };

  /**
   * Called when the user confirms they want a new exercise.
   * Runs the cleanup callback (which should clear state + call generate),
   * then hides the dialog.
   */
  const handleConfirm = (cleanupAndGenerate) => {
    cleanupAndGenerate();
    setShowConfirm(false);
  };

  /** Hides the dialog — user cancelled. */
  const handleCancel = () => setShowConfirm(false);

  return { showConfirm, onGenerateClick, handleConfirm, handleCancel };
};

export default useGenerateConfirm;