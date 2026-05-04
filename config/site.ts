export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "receipts",
  description:
    "A code review tool for the agentic era. Every diff, with receipts.",
  navItems: [
    { label: "Reviews", href: "/" },
    { label: "Rules", href: "/rules" },
  ],
  links: {
    github: "https://github.com/tjwds/receipts",
  },
};
