"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp, useSyncState } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { updateProfile, uploadAvatar } from "@/lib/actions";
import { pullAll, flush } from "@/lib/sync";
import { exportData, importData } from "@/lib/backup";
import { Card, SectionTitle, ListRow, Avatar, Segmented } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "INR"];

export default function SettingsPage() {
  const { session, profile } = useApp();
  const sync = useSyncState();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!session) return null;

  const statusLabel =
    sync.status === "offline" ? "Offline"
    : sync.status === "syncing" ? "Syncing…"
    : sync.status === "error" ? "Sync issue"
    : sync.pending > 0 ? `${sync.pending} pending`
    : "Up to date";

  return (
    <div className="screen px-5 pt-14">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-tint"><Icon name="chevronLeft" size={26} /></Link>
        <h1 className="large-title">Settings</h1>
      </div>

      <Card className="mb-6">
        <ListRow
          icon={<Avatar name={profile?.display_name ?? "?"} id={session.user.id} size={44} src={profile?.avatar_url} />}
          title={profile?.display_name ?? "…"}
          subtitle={`@${profile?.username ?? ""} · ${session.user.email ?? ""}`}
          onClick={() => setEditOpen(true)}
        />
      </Card>

      <SectionTitle>Preferences</SectionTitle>
      <Card className="mb-6">
        <div className="list-row !flex-col !items-stretch gap-2.5">
          <span className="text-[14px] text-sub">Currency</span>
          <Segmented
            options={CURRENCIES.slice(0, 3).map((c) => ({ value: c, label: c }))}
            value={profile?.currency ?? "PKR"}
            onChange={(c) => void updateProfile(session.user.id, { currency: c })}
          />
          <Segmented
            options={CURRENCIES.slice(3).map((c) => ({ value: c, label: c }))}
            value={profile?.currency ?? "PKR"}
            onChange={(c) => void updateProfile(session.user.id, { currency: c })}
          />
        </div>
        <ListRow
          title="Set aside from pay"
          right={<span className="text-[15px] font-semibold">{profile?.savings_percent ?? 20}%</span>}
        />
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card className="mb-6">
        <ListRow
          icon="sync"
          title="Sync status"
          subtitle={statusLabel}
          right={
            <button
              className="pill bg-card2 text-sub"
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                await flush();
                await pullAll();
                setSyncing(false);
              }}
            >
              {syncing ? "…" : "Sync now"}
            </button>
          }
        />
        <ListRow
          icon="wifiOff"
          title="Offline mode"
          subtitle="Works automatically — changes sync when you're back online"
        />
      </Card>

      <SectionTitle>Backup</SectionTitle>
      <Card className="mb-6">
        <ListRow
          icon="chevronDown"
          title="Download backup"
          subtitle="All your data as a JSON file"
          onClick={() => void exportData()}
        />
        <ListRow
          icon="chevronRight"
          title="Import backup"
          subtitle="Restore a downloaded file"
          onClick={() => fileRef.current?.click()}
        />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const n = await importData(f, session.user.id);
              setBackupMsg(`Imported ${n} rows — they'll sync shortly`);
            } catch {
              setBackupMsg("Couldn't read that file — use a Hisab backup JSON");
            }
          }}
        />
        {backupMsg && <p className="px-4 pb-3 text-[13px] text-sub">{backupMsg}</p>}
      </Card>

      <Card className="mb-6">
        <ListRow
          icon="logout"
          iconBg="rgba(255,69,58,0.15)"
          title={<span className="text-red">Sign out</span>}
          onClick={async () => {
            await supabase().auth.signOut();
            router.replace("/login");
          }}
        />
      </Card>

      <p className="text-center text-sub2 text-[12px] mb-8">Hisab · made for friends</p>

      {editOpen && <EditProfileSheet onClose={() => setEditOpen(false)} />}
    </div>
  );
}

function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const { session, profile } = useApp();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [savings, setSavings] = useState(String(profile?.savings_percent ?? 20));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  return (
    <Sheet title="Edit profile" onClose={onClose}>
      <div className="flex flex-col items-center mb-5">
        <Avatar name={profile?.display_name ?? "?"} id={session!.user.id} size={80} src={profile?.avatar_url} />
        <button
          className="text-tint text-[15px] font-medium mt-3"
          disabled={uploading}
          onClick={() => photoRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Change photo"}
        </button>
        {photoErr && <p className="text-red text-[12px] mt-1">{photoErr}</p>}
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setUploading(true);
            setPhotoErr("");
            try {
              await uploadAvatar(session!.user.id, f);
            } catch {
              setPhotoErr(navigator.onLine ? "Upload failed — try again" : "Needs a connection to upload");
            }
            setUploading(false);
          }}
        />
      </div>
      <label className="section-title">Display name</label>
      <input className="input mb-4" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="section-title">Set aside %</label>
      <input className="input mb-6" inputMode="decimal" value={savings} onChange={(e) => setSavings(e.target.value.replace(/[^\d.]/g, ""))} />
      <button
        className="btn"
        disabled={!name.trim() || saving}
        onClick={async () => {
          setSaving(true);
          await updateProfile(session!.user.id, {
            display_name: name.trim(),
            savings_percent: Math.min(90, Math.max(0, parseFloat(savings) || 0)),
          });
          setSaving(false);
          onClose();
        }}
      >
        Save
      </button>
    </Sheet>
  );
}
