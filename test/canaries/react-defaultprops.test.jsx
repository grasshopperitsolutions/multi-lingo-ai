import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PropTypes from "prop-types";

/**
 * The regression that shipped to production.
 *
 * React 19 removed `defaultProps` support for function components. 105 files
 * here declare PropTypes and 41 of them set `.defaultProps`, so the upgrade
 * turned every one of those defaults into `undefined` — silently. Nothing
 * threw, nothing warned at build time; `npm run lint` and `npm run build` both
 * went green and the dashboard shipped as a single column.
 *
 * These two tests exist because that failure is invisible to every other check
 * in CI. The first fails the moment React stops honouring defaults at all; the
 * second reproduces the exact symptom that reached users.
 *
 * STANDING DECISION: React stays pinned to 18.x. Dependabot will keep opening
 * the React 19 PR and this suite will keep failing it — that is the intended
 * outcome, not a broken test. Accepting React 19 means first migrating all 41
 * `.defaultProps` blocks in src/ to default parameters:
 *
 *   const C = ({ gridClassName = "grid grid-cols-2 ..." }) => ...
 *
 * Do that as its own change, verify in a browser, and only then take the bump.
 * Never make this suite pass by weakening it.
 */

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ({ isDarkMode: false, showAlert: vi.fn() }),
}));

describe("React still applies defaultProps to function components", () => {
  it("fills an omitted prop from defaultProps", () => {
    const Probe = ({ label }) => <span>{label}</span>;
    Probe.propTypes = { label: PropTypes.string };
    Probe.defaultProps = { label: "from-defaults" };

    render(<Probe />);

    // If this fails after a React bump, the 41 components listing defaults are
    // all silently broken — migrate them to default parameters (see the note
    // at the top of this file), do not delete or loosen this test.
    expect(screen.getByText("from-defaults")).toBeInTheDocument();
  });

  it("lets an explicit prop win over the default", () => {
    const Probe = ({ label }) => <span>{label}</span>;
    Probe.defaultProps = { label: "from-defaults" };

    render(<Probe label="explicit" />);

    expect(screen.getByText("explicit")).toBeInTheDocument();
  });
});

describe("DashboardFeatureGrid keeps its multi-column layout", () => {
  it("applies the default grid classes when gridClassName is omitted", async () => {
    const { default: DashboardFeatureGrid } = await import(
      "../../src/components/DashboardFeatureGrid"
    );

    const { container } = render(
      <MemoryRouter>
        <DashboardFeatureGrid
          tiles={[
            { id: "a", route: "/a", title: "Tile A", icon: () => <svg />, color: "blue" },
          ]}
        />
      </MemoryRouter>,
    );

    // The literal symptom users reported: "I only see one column now".
    const grid = container.querySelector(".grid");
    expect(grid).not.toBeNull();
    expect(grid.className).toContain("grid-cols-2");
    expect(grid.className).toContain("lg:grid-cols-3");
  });
});
