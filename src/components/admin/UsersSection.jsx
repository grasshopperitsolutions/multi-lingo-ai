import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Trash2, Loader2 } from "lucide-react";
import Loader from "../Loader";
import Avatar from "../Avatar";
import NeoDropdown from "../NeoDropdown";
import ConfirmModal from "../ConfirmModal";
import { GhostButton, SearchBar } from "../ui";

const TIER_OPTIONS = [
  { value: "explorer", label: "Explorer" },
  { value: "voyager", label: "Voyager" },
  { value: "maestro", label: "Maestro" },
  { value: "vip", label: "VIP" },
  { value: "admin", label: "Admin" },
];

const TIER_BADGE_STYLES = {
  admin: { dark: "bg-rose-900/40 text-rose-300 border-rose-700", light: "bg-rose-50 text-rose-700 border-rose-300" },
  vip: { dark: "bg-purple-900/40 text-purple-300 border-purple-700", light: "bg-purple-50 text-purple-700 border-purple-300" },
  maestro: { dark: "bg-blue-900/40 text-blue-300 border-blue-700", light: "bg-blue-50 text-blue-700 border-blue-300" },
  voyager: { dark: "bg-emerald-900/40 text-emerald-300 border-emerald-700", light: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  explorer: { dark: "bg-slate-700 text-slate-300 border-slate-600", light: "bg-slate-100 text-slate-500 border-slate-300" },
};

function TierBadge({ tier, isDarkMode }) {
  const styles = TIER_BADGE_STYLES[tier] ?? TIER_BADGE_STYLES.explorer;
  const classes = isDarkMode ? styles.dark : styles.light;
  return (
    <span className={`px-2 py-0.5 rounded-full border-2 text-[10px] font-black uppercase tracking-widest ${classes}`}>
      {tier}
    </span>
  );
}
TierBadge.propTypes = { tier: PropTypes.string.isRequired, isDarkMode: PropTypes.bool.isRequired };

function matchesSearch(user, term) {
  if (!term) return true;
  const haystack = [user.email, user.displayName, user.uid, user.provider, user.subscriptionTier]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function formatDate(value) {
  if (!value) return "—";
  // Firestore Timestamps come back over the proxy as { _seconds, _nanoseconds }
  if (typeof value === "object" && typeof value._seconds === "number") {
    return new Date(value._seconds * 1000).toLocaleDateString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

/**
 * UsersSection — admin list of every Firebase Auth user (merged with their
 * users/{uid} Firestore profile), filterable by a client-side text search
 * over the already-fetched list. Lets an admin change a user's
 * subscriptionTier (which doubles as their role — see tierLimits.js) or
 * permanently delete their account.
 */
const UsersSection = ({ users, isDarkMode, isLoadingDocs, error, currentUid, onSetTier, onDeleteUser }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTiers, setActiveTiers] = useState([]);
  const [savingUid, setSavingUid] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleTierFilter = (tier) => {
    setActiveTiers((prev) => (prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]));
  };

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          matchesSearch(u, searchTerm) &&
          (activeTiers.length === 0 || activeTiers.includes(u.subscriptionTier || "explorer"))
      ),
    [users, searchTerm, activeTiers]
  );

  const handleTierChange = async (uid, tier) => {
    setSavingUid(uid);
    try {
      await onSetTier(uid, tier);
    } finally {
      setSavingUid(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await onDeleteUser(deletingUser.uid);
      setDeletingUser(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoadingDocs) {
    return <Loader message="Loading users..." isDarkMode={isDarkMode} />;
  }

  if (error) {
    return <p className="font-bold text-rose-500">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by name, email, uid..."
        filters={TIER_OPTIONS}
        activeFilters={activeTiers}
        onFilterToggle={toggleTierFilter}
        isDarkMode={isDarkMode}
      />

      <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
        {filteredUsers.length} of {users.length} user{users.length === 1 ? "" : "s"}
      </p>

      {users.length === 0 && (
        <p className={`font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          No users found.
        </p>
      )}

      {users.length > 0 && filteredUsers.length === 0 && (
        <p className={`font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {searchTerm ? <>No users match &quot;{searchTerm}&quot;.</> : "No users match the selected filters."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {filteredUsers.map((u) => {
          const isSelf = u.uid === currentUid;
          return (
            <div
              key={u.uid}
              className={`p-4 rounded-xl border-2 ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-slate-50"}`}
            >
              <div className="flex flex-wrap items-center gap-4">
                <Avatar src={u.photoURL} alt={u.displayName || u.email} size={44} isDarkMode={isDarkMode} />

                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <p className={`font-black text-sm truncate ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    {u.displayName || "(no name)"}
                    {isSelf && (
                      <span className={`ml-2 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-yellow-400" : "text-blue-600"}`}>
                        You
                      </span>
                    )}
                  </p>
                  <p className={`text-xs truncate ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {u.email || "no email"} · {u.uid}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <TierBadge tier={u.subscriptionTier || "explorer"} isDarkMode={isDarkMode} />
                    {u.subscriptionStatus && (
                      <span className={`px-2 py-0.5 rounded-full border-2 text-[10px] font-black uppercase tracking-widest ${
                        u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing"
                          ? isDarkMode ? "border-emerald-700 text-emerald-300" : "border-emerald-300 text-emerald-700"
                          : u.subscriptionStatus === "past_due"
                            ? isDarkMode ? "border-rose-700 text-rose-300" : "border-rose-300 text-rose-700"
                            : isDarkMode ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-500"
                      }`}>
                        {u.subscriptionStatus}
                      </span>
                    )}
                    {u.cancelAtPeriodEnd && u.currentPeriodEnd && (
                      <span className={`px-2 py-0.5 rounded-full border-2 text-[10px] font-black uppercase tracking-widest ${
                        isDarkMode ? "border-amber-700 text-amber-300" : "border-amber-400 text-amber-700"
                      }`}>
                        Cancels {new Date(u.currentPeriodEnd * 1000).toLocaleDateString()}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                      Joined {formatDate(u.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <NeoDropdown
                    options={TIER_OPTIONS}
                    value={u.subscriptionTier}
                    onChange={(tier) => handleTierChange(u.uid, tier)}
                    isDarkMode={isDarkMode}
                    className="!min-w-[130px] !w-auto"
                  />
                  {savingUid === u.uid && (
                    <Loader2 size={16} className={`animate-spin ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
                  )}
                  <GhostButton
                    onClick={() => setDeletingUser(u)}
                    disabled={isSelf}
                    isDarkMode={isDarkMode}
                    className="!px-3 !py-2 !border-rose-500 !text-rose-500 hover:!bg-rose-500 hover:!text-white"
                  >
                    <Trash2 size={14} />
                  </GhostButton>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {deletingUser && (
        <ConfirmModal
          isDarkMode={isDarkMode}
          title="Delete User"
          message={`Permanently delete ${deletingUser.displayName || deletingUser.email || deletingUser.uid}? This removes their account, profile, and files. This cannot be undone.`}
          warning="This action is irreversible"
          confirmLabel="Delete User"
          confirmColor="rose"
          icon={<Trash2 size={24} />}
          isLoading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingUser(null)}
        />
      )}
    </div>
  );
};

UsersSection.propTypes = {
  users: PropTypes.array.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoadingDocs: PropTypes.bool.isRequired,
  error: PropTypes.string,
  currentUid: PropTypes.string,
  onSetTier: PropTypes.func.isRequired,
  onDeleteUser: PropTypes.func.isRequired,
};

export default UsersSection;
