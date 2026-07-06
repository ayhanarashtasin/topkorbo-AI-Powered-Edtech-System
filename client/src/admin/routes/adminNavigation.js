import {
  HiMiniAcademicCap,
  HiMiniBellAlert,
  HiMiniBookOpen,
  HiMiniChartBar,
  HiMiniClipboardDocumentList,
  HiMiniCog6Tooth,
  HiMiniHome,
  HiMiniLifebuoy,
  HiMiniLockClosed,
  HiMiniMegaphone,
  HiMiniQueueList,
  HiMiniReceiptPercent,
  HiMiniShieldCheck,
  HiMiniSquares2X2,
  HiMiniTicket,
  HiMiniUserGroup,
  HiMiniUsers
} from 'react-icons/hi2';

export const adminNavigation = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: HiMiniHome },
  { label: 'Users', to: '/admin/users', icon: HiMiniUsers },
  { label: 'Teachers', to: '/admin/teachers', icon: HiMiniAcademicCap },
  { label: 'Question Bank', to: '/admin/questions', icon: HiMiniClipboardDocumentList },
  { label: 'Academic Taxonomy', to: '/admin/academic-taxonomy', icon: HiMiniSquares2X2 },
  { label: 'Contests', to: '/admin/contests', icon: HiMiniTicket },
  { label: 'Books', to: '/admin/books', icon: HiMiniBookOpen },
  { label: 'IELTS Sets', to: '/admin/content/ielts-sets', icon: HiMiniQueueList },
  { label: 'Notices', to: '/admin/content/notices', icon: HiMiniMegaphone },
  { label: 'Waitlist', to: '/admin/content/waitlist', icon: HiMiniUserGroup },
  { label: 'Content Approval', to: '/admin/content-approval', icon: HiMiniQueueList },
  { label: 'Moderation', to: '/admin/moderation', icon: HiMiniShieldCheck },
  { label: 'Notifications', to: '/admin/notifications', icon: HiMiniMegaphone },
  { label: 'Analytics', to: '/admin/analytics', icon: HiMiniChartBar },
  { label: 'Payments', to: '/admin/payments', icon: HiMiniReceiptPercent },
  { label: 'Support', to: '/admin/support', icon: HiMiniLifebuoy },
  { label: 'Audit Logs', to: '/admin/audit-logs', icon: HiMiniBellAlert },
  { label: 'Security', to: '/admin/security', icon: HiMiniLockClosed },
  { label: 'Settings', to: '/admin/settings', icon: HiMiniCog6Tooth }
];

export function getAdminPageTitle(pathname) {
  return adminNavigation.find((item) => pathname.startsWith(item.to))?.label || 'Admin';
}
