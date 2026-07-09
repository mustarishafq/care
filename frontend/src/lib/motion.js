/** Standard entrance presets — see docs/DESIGN_TEMPLATE.md §20.1 */

export const pageHeaderMotion = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
};

export const contentSectionMotion = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.3 },
});

export const statCardMotion = (index = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: index * 0.05, duration: 0.3 },
});

export const listItemMotion = (index = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: index * 0.03, duration: 0.25 },
});

export const pageTransitionMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.2 },
};

export const heroMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};
