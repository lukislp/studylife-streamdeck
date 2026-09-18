// Shared course-dropdown population logic for the Property Inspector pages of the Focus Timer,
// Course Goal and Quick Note actions - all three offer "which course" from the same
// metrics.upcomingCourseGoals list the plugin process fetches once and forwards as a "courses"
// message (see plugin.ts's sendCourses). Kept in one file so the three PIs never drift on how
// that list becomes a <select>, per property-inspector.html.

/**
 * Fills `select` with one <option> per goal, keyed by courseId, preserving whatever value was
 * already selected when possible. `allowEmpty` adds a leading "(none)" option with value "" -
 * used by Focus Timer and Quick Note, where a course is optional, but not by Course Goal, which
 * has nothing useful to show without one.
 */
// eslint-disable-next-line no-unused-vars -- called from property-inspector.html
function populateCourseSelect(select, goals, allowEmpty) {
  if (!select) return;
  const previousValue = select.value;
  select.innerHTML = "";
  if (allowEmpty) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "(none)";
    select.appendChild(empty);
  }
  for (const goal of goals || []) {
    const option = document.createElement("option");
    option.value = String(goal.courseId);
    option.textContent = goal.courseName;
    select.appendChild(option);
  }
  const stillPresent = Array.prototype.some.call(select.options, (o) => o.value === previousValue);
  if (previousValue && stillPresent) select.value = previousValue;
}
