"use client";

import { useState } from "react";

type CopyAddressButtonProps = {
  address: `0x${string}`;
};

export function CopyAddressButton({ address }: CopyAddressButtonProps) {
  const [notice, setNotice] = useState("");

  const copyAddress = async () => {
    try {
      await navigator.clipboard?.writeText(address);
      setNotice("Address copied.");
    } catch {
      setNotice(address);
    }
  };

  return (
    <div className="copy-address-control">
      <button className="secondary-action" onClick={() => void copyAddress()} type="button">
        Copy Address
      </button>
      {notice && <p className="success-text">{notice}</p>}
    </div>
  );
}
