import { useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import Loader from "./Loader";

/**
 * Route guard: redirects a signed-out visitor to `/` instead of letting them
 * mount a page built entirely around a logged-in user.
 *
 * Extracted to its own file — unlike RequireOnboarding/RequireAdmin in
 * App.jsx — because it fixes a specific, previously-shipped bug and is worth
 * testing directly rather than only through the full route tree.
 *
 * The bug this replaces: DashboardLayout rendered `if (!user) return
 * <Loader fullScreen .../>` with nothing to ever change that — no redirect,
 * no timeout. A guest opening any /dashboard/* URL (a shared tutor-directory
 * link, a bookmark, a direct navigation after signing out in another tab) got
 * a spinner that never resolved. This guard sits in front of the whole
 * /dashboard subtree and sends a guest to the homepage instead, where signing
 * in is actually possible.
 *
 * Mirrors RequireOnboarding's shape: wait for isLoadingUser to settle before
 * deciding, so a user who *is* signed in but still loading is never bounced.
 */
const RequireAuth = ({ children }) => {
  const { user, isLoadingUser, isDarkMode } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoadingUser && !user) {
      navigate("/", { replace: true });
    }
  }, [user, isLoadingUser, navigate]);

  if (isLoadingUser) {
    return <Loader fullScreen isDarkMode={isDarkMode} />;
  }

  // Redirecting — render nothing rather than a second loader that would also
  // never resolve if the redirect were ever to stall.
  return user ? children : null;
};

RequireAuth.propTypes = {
  children: PropTypes.node.isRequired,
};

export default RequireAuth;
