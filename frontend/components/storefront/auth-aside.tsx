import Image from "next/image";

/** Panneau de marque affiché à côté des formulaires de connexion et de vérification (≥ 900 px). */
export function AuthAside({ text }: { text: string }) {
  return <aside className="auth-aside" aria-hidden="true"><Image src="/atelier.jpg" alt="" fill sizes="50vw" priority /><div className="auth-aside-overlay" /><div className="auth-aside-copy"><span className="auth-aside-brand">KEMI <em>SHOES</em></span>{text && <p>{text}</p>}</div></aside>;
}
