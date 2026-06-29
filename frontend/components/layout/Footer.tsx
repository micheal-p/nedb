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
          <Link href="/upload">Staff Upload Portal</Link>
          <Link href="/about">About NEDB</Link>
          <Link href="/data-point/login">Staff Login</Link>
        </div>
        <div className="ft-col">
          <h4>Policy & Legal</h4>
          <a href="#">ECN Act, CAP. E10</a>
          <a href="#">PIA Act 2021</a>
          <a href="#">National Energy Policy</a>
          <a href="#">NEDB Data Standards</a>
          <a href="#">ecnnigeria.org</a>
        </div>
      </div>
      <div className="ft-bottom">
        <span>
          &copy; {new Date().getFullYear()} Energy Commission of Nigeria. All rights reserved.
        </span>
        <span>NEDB Platform v1.0 &nbsp;·&nbsp; Data updated monthly</span>
      </div>
    </footer>
  );
}
