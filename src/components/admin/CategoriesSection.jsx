import { useState } from "react";
import PropTypes from "prop-types";
import { Pencil, Trash2, Plus } from "lucide-react";
import Loader from "../Loader";
import ConfirmModal from "../ConfirmModal";
import { GhostButton, PrimaryButton } from "../ui";

/**
 * CategoriesSection — admin CRUD list for interest categories
 * (appConfig/config/categories). Backed by categoriesService.js.
 */
const CategoriesSection = ({ categories, isDarkMode, isLoadingDocs, error, isDeleting, onAddCategory, onEditCategory, onDeleteCategory }) => {
  const [pendingDelete, setPendingDelete] = useState(null);

  const handleConfirmDelete = async () => {
    await onDeleteCategory(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PrimaryButton onClick={onAddCategory} isDarkMode={isDarkMode} color="emerald" className="!px-4 !py-2">
          <Plus size={16} />
          Add Category
        </PrimaryButton>
      </div>

      {isLoadingDocs && <Loader message="Loading categories..." isDarkMode={isDarkMode} />}

      {!isLoadingDocs && error && <p className="font-bold text-rose-500">{error}</p>}

      {!isLoadingDocs && !error && categories.length === 0 && (
        <p className={`font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          No categories in Firestore yet.
        </p>
      )}

      {!isLoadingDocs && !error && categories.length > 0 && (
        <div className="flex flex-col gap-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className={`flex items-center justify-between gap-3 p-4 rounded-xl border-2 ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-slate-50"}`}
            >
              <div className="min-w-0">
                <p className={`font-black text-sm ${isDarkMode ? "text-yellow-400" : "text-blue-600"}`}>
                  {category.label || category.id}
                </p>
                <p className={`text-xs font-mono ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                  {category.id}{category.order != null ? ` · order ${category.order}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <GhostButton onClick={() => onEditCategory(category)} isDarkMode={isDarkMode} className="!px-3 !py-2">
                  <Pencil size={14} />
                  Edit
                </GhostButton>
                <GhostButton onClick={() => setPendingDelete(category)} isDarkMode={isDarkMode} className="!px-3 !py-2 !text-rose-500 hover:!bg-rose-500 hover:!text-white">
                  <Trash2 size={14} />
                  Delete
                </GhostButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingDelete && (
        <ConfirmModal
          isDarkMode={isDarkMode}
          title="Delete Category?"
          message={`This will permanently remove "${pendingDelete.label || pendingDelete.id}" from Firestore. Users who already picked it will keep it stored, but it will no longer be selectable.`}
          confirmLabel="Delete"
          confirmColor="rose"
          icon={<Trash2 size={24} />}
          isLoading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => !isDeleting && setPendingDelete(null)}
        />
      )}
    </div>
  );
};

CategoriesSection.propTypes = {
  categories: PropTypes.array.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoadingDocs: PropTypes.bool.isRequired,
  error: PropTypes.string,
  isDeleting: PropTypes.bool.isRequired,
  onAddCategory: PropTypes.func.isRequired,
  onEditCategory: PropTypes.func.isRequired,
  onDeleteCategory: PropTypes.func.isRequired,
};

export default CategoriesSection;
