import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import { useTierAccess } from "../hooks/useTierAccess";
import Loader from "../components/Loader";
import { auth } from "../firebase";
import { CONFIG_SECTIONS, getConfigSectionDocs } from "../services/adminConfigService";
import { updateDocument } from "../services/firestoreService";
import { getPrompts, updatePrompt } from "../services/promptService";
import { getAuthProviders, setAuthProviderEnabled } from "../services/authProvidersService";
import { listAllUserProfiles, setUserTier, deleteAccount } from "../services/userService";
import { getLanguages } from "../services/supportedLanguagesService";
import { forceOverwriteAllTranslations, seedLanguageTranslations } from "../services/translationService";
import { createCategory, updateCategory, deleteCategory } from "../services/categoriesService";
import PromptsSection from "../components/admin/PromptsSection";
import PromptEditModal from "../components/admin/PromptEditModal";
import LoginProvidersSection from "../components/admin/LoginProvidersSection";
import UsersSection from "../components/admin/UsersSection";
import LocalesSection from "../components/admin/LocalesSection";
import CategoriesSection from "../components/admin/CategoriesSection";
import CategoryEditModal from "../components/admin/CategoryEditModal";
import GenericDocsSection from "../components/admin/GenericDocsSection";
import GenericDocEditModal from "../components/admin/GenericDocEditModal";
import { ArrowLeft, ShieldCheck, FileJson } from "lucide-react";

// ── Admin Page ───────────────────────────────────────────────────────────────
// Viewer/editor for the appConfig/config/* Firestore subcollections.
// The "prompts" section gets a dedicated editor (PromptsSection/PromptEditModal);
// every other section stays a read-only JSON dump.
const AdminPage = () => {
  const { isDarkMode, user, isLoadingUser, showAlert } = useAppContext();
  const { isAdmin } = useTierAccess();
  const navigate = useNavigate();

  const [activeSectionId, setActiveSectionId] = useState(CONFIG_SECTIONS[0].id);
  const [docsBySection, setDocsBySection] = useState({});
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [error, setError] = useState(null);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [categoryModal, setCategoryModal] = useState(null); // null | { category: object|null }
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [editingGenericDoc, setEditingGenericDoc] = useState(null); // null | { doc, collection }
  const [isSavingGenericDoc, setIsSavingGenericDoc] = useState(false);
  // TEMPORARY — prompt seeding.

  const activeSection = CONFIG_SECTIONS.find((s) => s.id === activeSectionId);
  const isPromptsSection = activeSectionId === "prompts";
  const isAuthProvidersSection = activeSectionId === "authProviders";
  const isUsersSection = activeSectionId === "users";
  const isLocalesSection = activeSectionId === "locales";
  const isCategoriesSection = activeSectionId === "categories";

  const loadSection = useCallback(async (section) => {
    setIsLoadingDocs(true);
    setError(null);
    try {
      const docs = section.id === "prompts"
        ? await getPrompts()
        : section.id === "authProviders"
          ? await getAuthProviders()
          : section.id === "users"
            ? await listAllUserProfiles(await auth.currentUser.getIdToken())
            : await getConfigSectionDocs(section.collection);
      setDocsBySection((prev) => ({ ...prev, [section.id]: docs }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  const handleToggleProvider = useCallback(async (id, enabled) => {
    try {
      await setAuthProviderEnabled(id, enabled);
      const updated = await getAuthProviders();
      setDocsBySection((prev) => ({ ...prev, authProviders: updated }));
      showAlert("success", `${id} sign-in ${enabled ? "enabled" : "disabled"}.`);
    } catch (err) {
      showAlert("error", `Could not update provider: ${err.message}`);
    }
  }, [showAlert]);

  const handleSavePrompt = useCallback(async (id, patch) => {
    setIsSavingPrompt(true);
    try {
      await updatePrompt(id, patch, {
        updatedBy: user?.email ?? "unknown",
        previousVersion: editingPrompt?.version ?? 1,
      });
      showAlert("success", "Prompt saved.");
      setEditingPrompt(null);
      const docs = await getPrompts();
      setDocsBySection((prev) => ({ ...prev, prompts: docs }));
    } catch (err) {
      showAlert("error", `Could not save prompt: ${err.message}`);
    } finally {
      setIsSavingPrompt(false);
    }
  }, [editingPrompt, user, showAlert]);

  const handleSetUserTier = useCallback(async (targetUid, tier) => {
    try {
      const token = await auth.currentUser.getIdToken();
      await setUserTier(token, targetUid, tier);
      showAlert("success", "User updated.");
      const updated = await listAllUserProfiles(token);
      setDocsBySection((prev) => ({ ...prev, users: updated }));
    } catch (err) {
      showAlert("error", `Could not update user: ${err.message}`);
    }
  }, [showAlert]);

  const handleDeleteUser = useCallback(async (targetUid) => {
    try {
      const token = await auth.currentUser.getIdToken();
      await deleteAccount(token, targetUid);
      showAlert("success", "User deleted.");
      const updated = await listAllUserProfiles(token);
      setDocsBySection((prev) => ({ ...prev, users: updated }));
    } catch (err) {
      showAlert("error", `Could not delete user: ${err.message}`);
    }
  }, [showAlert]);

  const refreshCategoriesDocs = useCallback(async () => {
    const updated = await getConfigSectionDocs(
      CONFIG_SECTIONS.find((s) => s.id === "categories").collection
    );
    setDocsBySection((prev) => ({ ...prev, categories: updated }));
  }, []);

  const handleSaveCategory = useCallback(async (id, data, isNew) => {
    setIsSavingCategory(true);
    try {
      if (isNew) {
        await createCategory(id, data);
      } else {
        await updateCategory(id, data);
      }
      showAlert("success", isNew ? "Category created." : "Category saved.");
      setCategoryModal(null);
      await refreshCategoriesDocs();
    } catch (err) {
      showAlert("error", `Could not save category: ${err.message}`);
    } finally {
      setIsSavingCategory(false);
    }
  }, [showAlert, refreshCategoriesDocs]);

  const handleDeleteCategory = useCallback(async (id) => {
    setIsDeletingCategory(true);
    try {
      await deleteCategory(id);
      showAlert("success", "Category deleted.");
      await refreshCategoriesDocs();
    } catch (err) {
      showAlert("error", `Could not delete category: ${err.message}`);
    } finally {
      setIsDeletingCategory(false);
    }
  }, [showAlert, refreshCategoriesDocs]);

  const handleSaveGenericDoc = useCallback(async (docId, data) => {
    setIsSavingGenericDoc(true);
    try {
      const { collection, sectionId } = editingGenericDoc;
      await updateDocument(collection, docId, data);
      showAlert("success", `${docId} saved.`);
      setEditingGenericDoc(null);
      const updated = await getConfigSectionDocs(collection);
      setDocsBySection((prev) => ({ ...prev, [sectionId]: updated }));
    } catch (err) {
      showAlert("error", `Could not save document: ${err.message}`);
    } finally {
      setIsSavingGenericDoc(false);
    }
  }, [editingGenericDoc, showAlert]);

  const refreshLocalesDocs = useCallback(async () => {
    const updated = await getConfigSectionDocs(
      CONFIG_SECTIONS.find((s) => s.id === "locales").collection
    );
    setDocsBySection((prev) => ({ ...prev, locales: updated }));
  }, []);

  // Let a total failure (e.g. getLanguages() itself throwing) propagate up
  // uncaught — LocalesSection's own handler catches it into its inline
  // runError banner, so it isn't double-handled here too.
  const handleForceOverwriteTranslations = useCallback(async (onProgress) => {
    const token = await auth.currentUser.getIdToken();
    const languages = await getLanguages(token);
    const summary = await forceOverwriteAllTranslations(languages, token, { onProgress });
    await refreshLocalesDocs();
    if (summary.total === 0) {
      showAlert("success", "No languages to process.");
    } else if (summary.failed === 0) {
      showAlert("success", `${summary.succeeded} of ${summary.total} languages overwritten.`);
    } else {
      showAlert("error", `${summary.succeeded} succeeded, ${summary.failed} failed. See details below.`);
    }
    return summary;
  }, [showAlert, refreshLocalesDocs]);

  const handleRefreshLocale = useCallback(async (code) => {
    try {
      const token = await auth.currentUser.getIdToken();
      await seedLanguageTranslations(code, token);
      await refreshLocalesDocs();
      showAlert("success", `"${code}" translations refreshed.`);
    } catch (err) {
      showAlert("error", `Could not refresh "${code}": ${err.message}`);
    }
  }, [showAlert, refreshLocalesDocs]);

  useEffect(() => {
    if (!isAdmin || docsBySection[activeSectionId]) return;
    loadSection(activeSection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionId, isAdmin]);

  if (isLoadingUser) {
    return <Loader fullScreen message="Loading..." isDarkMode={isDarkMode} />;
  }

  if (!user || !isAdmin) {
    return null;
  }

  const sectionClasses = `p-8 rounded-[2rem] border-4 mb-6
    ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`;

  const docs = docsBySection[activeSectionId] ?? [];

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-10">
      <button
        onClick={() => navigate("/dashboard")}
        className={`flex items-center gap-2 mb-8 font-black uppercase tracking-widest text-sm transition-all hover:-translate-x-1
          ${isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      <h1
        className={`flex items-center gap-3 text-4xl font-black uppercase tracking-tighter mb-8
          ${isDarkMode ? "text-white" : "text-slate-900"}`}
      >
        <ShieldCheck size={32} />
        App Config
      </h1>

      <div className="flex flex-wrap gap-3 mb-6">
        {CONFIG_SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSectionId(section.id)}
            className={`px-4 py-2 rounded-full border-2 font-black uppercase text-xs tracking-widest transition-all active:scale-95
              ${
                section.id === activeSectionId
                  ? isDarkMode
                    ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[3px_3px_0px_0px_#854d0e]"
                    : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
                  : isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-300"
                    : "bg-white border-slate-300 text-slate-600"
              }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className={sectionClasses}>
        <div className="flex items-center justify-between mb-4">
          <h2
            className={`flex items-center gap-2 text-lg font-black uppercase tracking-widest
              ${isDarkMode ? "text-white" : "text-slate-900"}`}
          >
            <FileJson size={20} />
            {activeSection.label}
          </h2>
          <span className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {activeSection.collection}
          </span>
        </div>

        {isLocalesSection ? (
          <LocalesSection
            docs={docs}
            isDarkMode={isDarkMode}
            isLoadingDocs={isLoadingDocs}
            error={error}
            onForceOverwrite={handleForceOverwriteTranslations}
            onRefreshLocale={handleRefreshLocale}
          />
        ) : isPromptsSection ? (
          <PromptsSection
            prompts={docs}
            isDarkMode={isDarkMode}
            isLoadingDocs={isLoadingDocs}
            error={error}
            onEditPrompt={setEditingPrompt}
          />
        ) : isCategoriesSection ? (
          <CategoriesSection
            categories={docs}
            isDarkMode={isDarkMode}
            isLoadingDocs={isLoadingDocs}
            error={error}
            isDeleting={isDeletingCategory}
            onAddCategory={() => setCategoryModal({ category: null })}
            onEditCategory={(category) => setCategoryModal({ category })}
            onDeleteCategory={handleDeleteCategory}
          />
        ) : isAuthProvidersSection ? (
          <LoginProvidersSection
            providers={docsBySection.authProviders ?? {}}
            isDarkMode={isDarkMode}
            isLoadingDocs={isLoadingDocs}
            error={error}
            onToggle={handleToggleProvider}
          />
        ) : isUsersSection ? (
          <UsersSection
            users={docs}
            isDarkMode={isDarkMode}
            isLoadingDocs={isLoadingDocs}
            error={error}
            currentUid={user?.uid}
            onSetTier={handleSetUserTier}
            onDeleteUser={handleDeleteUser}
          />
        ) : (
          <GenericDocsSection
            key={activeSectionId}
            docs={docs}
            isDarkMode={isDarkMode}
            isLoadingDocs={isLoadingDocs}
            error={error}
            onEditDoc={(doc) => setEditingGenericDoc({ doc, collection: activeSection.collection, sectionId: activeSectionId })}
          />
        )}
      </div>

      {editingGenericDoc && (
        <GenericDocEditModal
          doc={editingGenericDoc.doc}
          isDarkMode={isDarkMode}
          isSaving={isSavingGenericDoc}
          onSave={handleSaveGenericDoc}
          onClose={() => setEditingGenericDoc(null)}
        />
      )}

      {editingPrompt && (
        <PromptEditModal
          prompt={editingPrompt}
          isDarkMode={isDarkMode}
          isSaving={isSavingPrompt}
          onSave={handleSavePrompt}
          onClose={() => setEditingPrompt(null)}
        />
      )}

      {categoryModal && (
        <CategoryEditModal
          category={categoryModal.category}
          isDarkMode={isDarkMode}
          isSaving={isSavingCategory}
          onSave={handleSaveCategory}
          onClose={() => setCategoryModal(null)}
        />
      )}
    </main>
  );
};

export default AdminPage;
