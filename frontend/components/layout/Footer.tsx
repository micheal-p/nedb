import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="ft-grid">
        <div className="ft-brand">
          <div className="ft-name">National Energy Data Bank (NEDB)</div>
          <p>
            An initiative of the Energy Commission of Nigeria (ECN), providing authoritative
            energy statistics in support of national planning, regulatory oversight, and
            public transparency.
          </p>
          <a href="https://energy.gov.ng" target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: "0.75rem", fontSize: "0.78rem", color: "var(--green-mid)", fontWeight: 600 }}>
            energy.gov.ng
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M17 7H7M17 7v10"/>
            </svg>
          </a>
        </div>
        <div className="ft-col">
          <h4>Data Bank</h4>
          <Link href="/">Series Explorer</Link>
          <Link href="/series/crude_oil_production">Crude Oil Production</Link>
          <Link href="/series/electricity_generation">Electricity Generation</Link>
          <Link href="/series/pms_sales">PMS Sales</Link>
          <Link href="/series/natural_gas_production">Natural Gas</Link>
        </div>
        <div className="ft-col">
          <h4>Platform</h4>
          <Link href="/data-point">Data Point</Link>
          <Link href="/about">About NEDB</Link>
          <Link href="/data-point/login">Portal Login</Link>
          <Link href="/revisions">Data Revision Log</Link>
          <Link href="/africa">Nigeria in Africa</Link>
        </div>
        <div className="ft-col">
          <h4>Policy &amp; Legal</h4>
          <a href="/documents/ecn_act.pdf" target="_blank" rel="noopener noreferrer">ECN Act, CAP. E10</a>
          <a href="/documents/Petroleum_Industry_Act_2021.pdf" target="_blank" rel="noopener noreferrer">PIA Act 2021</a>
          <a href="/documents/Energy_Policy_Document.pdf" target="_blank" rel="noopener noreferrer">National Energy Policy</a>
          <a href="/documents/Hydrocarbon_Oil_Refinery_Act.pdf" target="_blank" rel="noopener noreferrer">Hydrocarbon Oil Refinery Act</a>
          <a href="https://energy.gov.ng" target="_blank" rel="noopener noreferrer">ECN Official Site</a>
        </div>
      </div>
      <div className="ft-bottom">
        <span>
          &copy; {new Date().getFullYear()} Energy Commission of Nigeria. All rights reserved. &nbsp;·&nbsp; Powered by Norgroup Ltd
        </span>
        <span>NEDB Platform v1.0 &nbsp;·&nbsp; Data updated monthly</span>
      </div>
    </footer>
  );
}
