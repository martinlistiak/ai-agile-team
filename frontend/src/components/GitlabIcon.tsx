type GitlabIconProps = {
  /** Pixel width and height (square). */
  size?: number;
  className?: string;
};

/**
 * Official GitLab mark (RGB). Source: about.gitlab.com press kit → gitlab-icon-rgb.svg.
 */
export function GitlabIcon({ size = 20, className }: GitlabIconProps) {
  return (
    <img
      src="/gitlab-icon.svg"
      alt=""
      width={size}
      height={size}
      className={className}
      draggable={false}
      aria-hidden
    />
  );
}
