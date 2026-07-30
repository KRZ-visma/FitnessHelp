import { getAllAchievements, getAchievementStats } from "./achievements.js";

/**
 * @param {HTMLElement} container
 */
export function renderAchievements(container) {
  const achievements = getAllAchievements();
  const stats = getAchievementStats();

  const section = document.createElement("section");
  section.className = "achievements-section statistics-section";

  const header = document.createElement("div");
  header.className = "achievements-header";
  header.innerHTML = `
    <h2 class="statistics-section-title">Badges</h2>
    <p class="achievements-progress">
      ${stats.unlocked} van ${stats.total} ontgrendeld (${stats.percentage}%)
    </p>
  `;
  section.appendChild(header);

  const groupedByCategory = {
    milestone: [],
    streak: [],
    dedication: [],
    champion: [],
  };

  achievements.forEach((achievement) => {
    groupedByCategory[achievement.category].push(achievement);
  });

  const categories = [
    { id: "milestone", title: "Mijlpalen" },
    { id: "streak", title: "Streaks" },
    { id: "dedication", title: "Toewijding" },
    { id: "champion", title: "Kampioenen" },
  ];

  categories.forEach((cat) => {
    const badges = groupedByCategory[cat.id];
    if (!badges.length) return;

    const categoryEl = document.createElement("div");
    categoryEl.className = "achievements-category";

    const categoryTitle = document.createElement("h3");
    categoryTitle.className = "achievements-category-title";
    categoryTitle.textContent = cat.title;
    categoryEl.appendChild(categoryTitle);

    const grid = document.createElement("div");
    grid.className = "achievements-grid";

    badges.forEach((achievement) => {
      const badge = document.createElement("div");
      badge.className = achievement.unlocked
        ? "achievement-badge is-unlocked"
        : "achievement-badge is-locked";
      badge.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-info">
          <div class="achievement-title">${achievement.title}</div>
          <div class="achievement-description">${achievement.description}</div>
        </div>
      `;
      grid.appendChild(badge);
    });

    categoryEl.appendChild(grid);
    section.appendChild(categoryEl);
  });

  container.appendChild(section);
}
