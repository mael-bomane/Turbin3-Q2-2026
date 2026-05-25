import Link from "next/link";
import { FaGithub, FaTelegramPlane } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import config from "@/config";

const socials = [
  {
    icon: <FaTelegramPlane className="size-4" />,
    href: "https://t.me/mbomane",
    label: "Telegram",
  },
  {
    icon: <FaXTwitter className="size-4" />,
    href: "https://x.com/mael_bomane",
    label: "Twitter",
  },
  {
    icon: <FaGithub className="size-4" />,
    href: "https://github.com/mael-bomane",
    label: "Github",
  },
];

export function Footer() {
  return (
    <footer className="border-t border-primary dark:border-network z-[999]">
      <div className="container lg:max-w-7xl mx-auto flex items-center justify-between px-8 py-4">
        <span className="text-xs text-muted-foreground">
          {/* © {new Date().getFullYear()}{" "}
          <Link href="/" className="hover:text-foreground transition-colors">
            {config.domainName}
          </Link> */}
          made with ❤️ by mael
        </span>

        <ul className="flex items-center gap-5 text-muted-foreground">
          {socials.map((s) => (
            <li key={s.label}>
              <Link
                href={s.href}
                aria-label={s.label}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground dark:hover:text-network transition-colors"
              >
                {s.icon}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
