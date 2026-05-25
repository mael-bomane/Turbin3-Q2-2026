"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import logo from "@/app/icon.png";
import config from "@/config";
import { Button } from "./ui/button";
import { FaGithub, FaTelegramPlane } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { useNetwork, NETWORK_CONFIG } from "@/components/providers/NetworkProvider";
import { SolanaPriceTicker } from "./SolanaPriceTicker";

import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import dynamic from "next/dynamic";

const WalletButton = dynamic(() => import("./WalletButton").then((m) => m.WalletButton), {
  ssr: false,
});

const inter = Inter({
  weight: "800",
  subsets: ["latin"],
});

const links: {
  href: string;
  label: string;
}[] = [
    {
      href: "/escrow",
      label: "escrow",
    },
    {
      href: "/amm",
      label: "amm",
    },
    // {
    //   href: "/collections",
    //   label: "collections",
    // },
    // {
    //   href: "/#",
    //   label: "portfolio",
    // },
    // {
    //   href: "/#",
    //   label: "activity",
    // },
    // {
    //   href: "/#",
    //   label: "points",
    // },
  ];

const cta: JSX.Element = <WalletButton />;

const Header = () => {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { network } = useNetwork();

  useEffect(() => {
    setIsOpen(false);
  }, [searchParams]);

  // const socialLinks = [
  //   // { icon: <FaDiscord className="size-5" />, href: "https://discord.com/invite/uTUXr43", label: "Discord" },
  //   {
  //     icon: <FaTelegramPlane className="size-5" />,
  //     href: "https://t.me/mbomane",
  //     label: "Telegram",
  //   },
  //   {
  //     icon: <FaXTwitter className="size-5" />,
  //     href: "https://x.com/mael_bomane",
  //     label: "Twitter",
  //   },
  //   {
  //     icon: <FaGithub className="size-5" />,
  //     href: "https://github.com/mael-bomane",
  //     label: "Github",
  //   },
  // ];

  return (
    <header className="bg-white dark:bg-background z-[2] border-b border-primary dark:border-network">
      <nav
        className="relative container flex lg:max-w-7xl items-center justify-between px-8 py-4 mx-auto"
        aria-label="Global"
      >
        {/* LEFT */}
        <div className="flex lg:flex-1 items-center">
          <Link
            className="flex items-center gap-2 shrink-0"
            href="/"
            title={`${config.appName} homepage`}
          >
            <Image
              src={logo}
              alt={`${config.appName} logo`}
              className="rounded-full w-9 h-9 transform scale-x-[-1]"
              //placeholder="blur"
              priority={true}
              width={24}
              height={24}
              unoptimized
            />
            <h1
              className={cn(
                inter.className,
                "ml-2 text-xl tracking-wide text-network",
              )}
            >
              {config.appName}
            </h1>
          </Link>
          <div className="ml-4 hidden sm:flex">
            <SolanaPriceTicker />
          </div>
          <div className="ml-8 hidden text-xs lg:flex gap-4 items-center">
            {links.map((link, i) => (
              <Link key={i} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* CENTER (absolute)         <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-sm px-4">
          <Input
            placeholder="search collection or wallet"
            value={""}
            onChange={() => null}
            className="w-full !rounded-none"
          />
        </div>
        */}

        {/* RIGHT */}
        <div className="hidden lg:flex lg:flex-1 justify-end space-x-4 items-center">
          {/* <Button
            variant="outline"
            size="sm"
            className="!rounded-none text-xs pointer-events-none"
          >
            {NETWORK_CONFIG[network].label}
          </Button> */}
          {cta}
        </div>

        {/* MOBILE MENU */}
        <div className="flex lg:hidden">
          <Button size="lg" variant="secondary" onClick={() => setIsOpen(true)}>
            ☰
          </Button>
        </div>
      </nav>

      {/* Mobile menu, show/hide based on menu state. */}
      <div className={cn("relative z-50", isOpen ? "h-screen" : "hidden")}>
        <div
          className={`fixed inset-y-0 right-0 flex flex-col h-full z-10 w-full px-8 py-4 overflow-y-auto bg-white dark:bg-background sm:max-w-sm sm:ring-1 sm:ring-neutral/10 transform origin-right transition ease-in-out duration-300`}
        >
          <div className="flex flex-col flex-1 w-full">
            {/* Your logo/name on small screens */}
            <div className="flex items-center justify-between">
              <Link
                className="flex items-center gap-2 shrink-0 "
                href="/"
                title={`${config.appName} homepage`}
              >
                <Image
                  src={logo}
                  alt={`${config.appName} logo`}
                  className="rounded-full w-12 h-12 transform scale-x-[-1]"
                  //placeholder="blur"
                  priority={true}
                  width={50}
                  height={50}
                  unoptimized
                />
                <span
                  className={cn(
                    inter.className,
                    "ml-2 text-2xl tracking-[-0.03em] bg-[length:300%_300%] bg-[linear-gradient(60deg,#BBFF99,#99FFDD,#99BAFF,#DD99FF,#FF99BA,#FFDD99)] bg-clip-text text-transparent animate-gradient",
                  )}
                >
                  {config.appName}
                </span>
              </Link>
              <button
                type="button"
                className="-m-2.5 rounded-md p-2.5"
                onClick={() => setIsOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6 text-base-content dark:text-network"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-grow"></div>
            {/* links on small screens */}
            <div className="mt-auto">
              <hr className="border-t border-network" />
              {/* <ul className="py-4 flex dark:text-network text-black justify-center items-center space-x-6 mx-auto">
                {socialLinks.map((social, idx) => (
                  <li key={idx} className="hover:text-primary font-medium">
                    <Link
                      href={social.href}
                      aria-label={social.label}
                      target="_blank"
                    >
                      {social.icon}
                    </Link>
                  </li>
                ))}
              </ul> */}
              {/*<div className="flex flex-col gap-y-4 items-start">
                {links.map((link) => (
                  <Link
                    href={link.href}
                    key={link.href}
                    className="link link-hover"
                    title={link.label}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>*/}
            </div>
            <div className="flex justify-center items-center space-x-4 mr-4"></div>
            <div className="divider"></div>
            {/* CTA on small screens */}
            <div className="flex flex-col">{cta}</div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
