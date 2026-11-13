import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import { superAdminSessionStore } from "@/modules/super-admin-auth";
import { PageMeta } from "@/shell/meta";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { initialsOf } from "../initials";

/** Shown if the session has no name, which should not happen for a logged in user. */
const FALLBACK_NAME = "Superadministrador";

/** "My profile": only the name of the person who is logged in. */
const ProfilePage = observer(function ProfilePage() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const username = superAdminSessionStore.superAdmin?.username;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <WorkspaceLayout section="Mi perfil" className="ws-enter">
      <PageMeta title="Necto · Mi perfil" />

      <div className="ws-heading">
        <div>
          <span className="ws-eyebrow">TU CUENTA</span>
          <h1 ref={headingRef} tabIndex={-1}>
            Mi perfil
          </h1>
        </div>
      </div>

      <section className="ws-profile" aria-labelledby="ws-profile-label">
        <span className="ws-profile-avatar" aria-hidden="true">
          {initialsOf(username)}
        </span>
        <div>
          <span id="ws-profile-label" className="ws-profile-label">
            NOMBRE
          </span>
          <p className="ws-profile-name">{username ?? FALLBACK_NAME}</p>
        </div>
      </section>
    </WorkspaceLayout>
  );
});

export default ProfilePage;
