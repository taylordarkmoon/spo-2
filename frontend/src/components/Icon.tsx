import type { ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  check: <path d='M5 12.5l4.5 4.5L19 7.5' />,
  eye: (
    <>
      <path d='M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z' />
      <circle cx='12' cy='12' r='3' />
    </>
  ),
  eyeOff: (
    <>
      <path d='M3 3l18 18' />
      <path d='M10.6 5.1A10 10 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4M6.5 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.5 0 2.8-.4 4-.9' />
      <path d='M9.9 9.9a3 3 0 004.2 4.2' />
    </>
  ),
  search: (
    <>
      <circle cx='11' cy='11' r='7' />
      <path d='M20 20l-3.5-3.5' />
    </>
  ),
  sliders: (
    <>
      <path d='M4 7h10M18 7h2M4 17h2M10 17h10' />
      <circle cx='16' cy='7' r='2' />
      <circle cx='8' cy='17' r='2' />
    </>
  ),
  plus: <path d='M12 5v14M5 12h14' />,
  heart: (
    <path d='M12 20.5s-7.5-4.6-9.2-9.4C1.8 8 3.6 5 6.7 5c1.9 0 3.4 1 5.3 3 1.9-2 3.4-3 5.3-3 3.1 0 4.9 3 3.9 6.1-1.7 4.8-9.2 9.4-9.2 9.4z' />
  ),
  layers: (
    <>
      <path d='M12 3l9 5-9 5-9-5 9-5z' />
      <path d='M3 13l9 5 9-5' />
    </>
  ),
  user: (
    <>
      <circle cx='12' cy='8' r='4' />
      <path d='M4 20c0-4 3.6-6 8-6s8 2 8 6' />
    </>
  ),
  arrowRight: <path d='M5 12h14M13 6l6 6-6 6' />,
  arrowUpRight: <path d='M7 17L17 7M8 7h9v9' />,
  arrowLeft: <path d='M19 12H5M11 6l-6 6 6 6' />,
  close: <path d='M6 6l12 12M18 6L6 18' />,
  pencil: <path d='M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19l-4 1z' />,
  chevron: <path d='M9 6l6 6-6 6' />,
  upload: (
    <>
      <path d='M12 16V4M7 9l5-5 5 5' />
      <path d='M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3' />
    </>
  ),
  file: (
    <>
      <path d='M6 3h8l5 5v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z' />
      <path d='M14 3v5h5' />
    </>
  ),
  download: (
    <>
      <path d='M12 4v12M7 11l5 5 5-5' />
      <path d='M4 18v1a1 1 0 001 1h14a1 1 0 001-1v-1' />
    </>
  ),
  external: (
    <>
      <path d='M14 4h6v6M20 4l-9 9' />
      <path d='M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5' />
    </>
  ),
  trash: (
    <>
      <path d='M4 7h16M10 11v6M14 11v6' />
      <path d='M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12M9 7V4h6v3' />
    </>
  ),
  shield: (
    <>
      <path d='M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z' />
      <path d='M9 12l2 2 4-4' />
    </>
  ),
  users: (
    <>
      <circle cx='9' cy='8' r='3.5' />
      <path d='M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5' />
      <path d='M16 4.7a3.5 3.5 0 010 6.6M18 14.8c2.2.6 3.5 2.4 3.5 5.2' />
    </>
  ),
  flag: <path d='M5 21V4M5 4h11l-2 4 2 4H5' />,
  lock: (
    <>
      <rect x='5' y='11' width='14' height='10' rx='2' />
      <path d='M8 11V8a4 4 0 018 0v3' />
    </>
  ),
  logout: (
    <>
      <path d='M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h5' />
      <path d='M15 8l4 4-4 4M19 12H9' />
    </>
  ),
};

export type IconName = keyof typeof paths;

interface Props {
  name: IconName;
  size?: number;
  filled?: boolean;
  className?: string;
}

export function Icon({ name, size = 20, filled = false, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill={filled ? 'currentColor' : 'none'}
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
