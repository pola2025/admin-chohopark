/**
 * 관리자 화면 아이콘.
 *
 * 이모지는 기기와 브라우저마다 모양과 색이 달라져서 화면 톤이 흐트러진다.
 * 그래서 전부 단색 선 아이콘으로 통일했다. 색은 currentColor 를 따르므로
 * 글자 색만 바꾸면 아이콘도 함께 따라온다.
 */
import type { SVGProps } from "react";

export type IconName =
  | "dashboard"
  | "calendar"
  | "message"
  | "template"
  | "inbox"
  | "chart"
  | "contract"
  | "menu"
  | "close"
  | "won"
  | "clock"
  | "search"
  | "plus"
  | "edit"
  | "trash"
  | "check"
  | "alert"
  | "chevronLeft"
  | "chevronRight"
  | "chevronDown"
  | "download"
  | "refresh"
  | "user"
  | "users"
  | "phone"
  | "mail"
  | "send"
  | "home"
  | "more"
  | "external";

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="8" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="11" width="7" height="10" />
      <rect x="3" y="14" width="7" height="7" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  message: (
    <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8z" />
  ),
  template: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h7M9 16h7" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13h5l1 3h6l1-3h5" />
      <path d="M5 5h14l2 8v6H3v-6z" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  contract: (
    <>
      <path d="M7 3h7l4 4v10H7z" />
      <path d="M14 3v4h4" />
      <path d="M5 20c2-2 3 1 5-1s3 1 5-1 3 1 5-1" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  won: (
    <>
      <path d="M4 7l3 10 3-7 3 7 3-10" />
      <path d="M3 11h18M3 14h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <path d="M4 20h4L19 9a2 2 0 0 0-3-3L5 17v3z" />,
  trash: <path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  check: <path d="M4 12l5 5L20 6" />,
  alert: (
    <>
      <path d="M12 3l9 17H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronDown: <path d="M5 9l7 7 7-7" />,
  download: <path d="M12 4v11M7 11l5 5 5-5M4 20h16" />,
  refresh: <path d="M20 11a8 8 0 1 0-1 5M20 5v6h-6" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" />
      <path d="M16 5.5a3.5 3.5 0 0 1 0 7M18 20c0-2.6-1-4.3-2.5-5.3" />
    </>
  ),
  phone: (
    <path d="M6 3h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  send: <path d="M4 12l16-8-6 16-2-6-8-2z" />,
  home: <path d="M4 11l8-7 8 7v9H4z" />,
  more: <path d="M4 7h16M4 12h16M4 17h16" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
};

type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  /** 한 변의 길이(px). 기본 20 */
  size?: number;
};

export function Icon({ name, size = 20, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
