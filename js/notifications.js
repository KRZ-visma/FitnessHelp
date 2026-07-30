/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   icon: string
 * }} Notification
 */

/** @type {Set<string>} */
const activeNotifications = new Set();

/**
 * @param {Notification} notification
 */
export function showAchievementNotification(notification) {
  if (activeNotifications.has(notification.id)) return;
  activeNotifications.add(notification.id);

  const toast = document.createElement("div");
  toast.className = "achievement-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  toast.innerHTML = `
    <div class="achievement-toast-icon">${notification.icon}</div>
    <div class="achievement-toast-content">
      <div class="achievement-toast-title">Badge ontgrendeld!</div>
      <div class="achievement-toast-subtitle">${notification.title}</div>
      <div class="achievement-toast-description">${notification.description}</div>
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("is-visible");
  }, 50);

  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => {
      toast.remove();
      activeNotifications.delete(notification.id);
    }, 400);
  }, 4000);
}

/**
 * @param {Array<{ id: string, title: string, description: string, icon: string }>} achievements
 */
export function showAchievementNotifications(achievements) {
  achievements.forEach((achievement, index) => {
    setTimeout(() => {
      showAchievementNotification(achievement);
    }, index * 500);
  });
}
