import React from "react";
import "./styles.scss";

const SystemNav = (services) => {
  return (
    <section className="system-nav">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <input
              className="system-nav__searchbar"
              type="text"
              placeholder="Search project_code and hit enter."
            />
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            {services.map(
              ({ last_update, service_id, dependencies, system_modules, server_modules }) => {}
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SystemNav;
