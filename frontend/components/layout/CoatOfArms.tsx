import Image from "next/image";

export default function CoatOfArms({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/coat-of-arms-ng.svg"
      alt="Federal Republic of Nigeria Coat of Arms"
      width={size}
      height={size}
      priority
      style={{ objectFit: "contain" }}
    />
  );
}
