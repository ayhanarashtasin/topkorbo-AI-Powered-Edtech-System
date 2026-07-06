import { useState } from 'react';

const TIMEZONE_OPTIONS = [
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'America/New_York',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney'
];

function buildInitialForm(contest, cloneFromContestId = '') {
  return {
    name: contest?.name || '',
    level: contest?.level || 'hsc',
    questionType: contest?.questionType || 'mcq',
    subjects: Array.isArray(contest?.subjects) ? contest.subjects.join(', ') : '',
    admissionType: contest?.admissionType || 'medical',
    admissionSubtype: contest?.admissionSubtype || '',
    date: contest?.date || '',
    durationHours: String(contest?.duration?.hours ?? 1),
    durationMinutes: String(contest?.duration?.minutes ?? 0),
    startHour: String(contest?.startTime?.hour ?? 12),
    startMinute: String(contest?.startTime?.minute ?? 0),
    startPeriod: contest?.startTime?.period || 'AM',
    timezone: contest?.startTime?.timezone || 'Asia/Dhaka',
    adminStatus: contest?.adminStatus || 'archived',
    cloneFromContestId,
    reason: ''
  };
}

export default function AdminContestFormModal({
  open,
  mode,
  contest = null,
  cloneOptions = [],
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState(() => buildInitialForm(contest));

  if (!open) return null;

  const isEdit = mode === 'edit';

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
        <h3>{isEdit ? 'Edit contest' : 'Create contest'}</h3>
        <p>
          {isEdit
            ? 'Update the existing contest metadata without changing the broader student or teacher contest system.'
            : 'Create a contest entry using the existing contest schema. To safely make a new contest active, clone an existing contest question set.'}
        </p>

        <div className="admin-toolbar" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <label className="admin-field">
            <span>Title</span>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </label>
          <label className="admin-field">
            <span>Status</span>
            <select value={form.adminStatus} onChange={(event) => setForm((prev) => ({ ...prev, adminStatus: event.target.value }))}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Level</span>
            <select value={form.level} onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}>
              <option value="hsc">HSC</option>
              <option value="admission">Admission</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Question type</span>
            <select value={form.questionType} onChange={(event) => setForm((prev) => ({ ...prev, questionType: event.target.value }))}>
              <option value="mcq">MCQ</option>
              <option value="cq">CQ</option>
              <option value="both">Both</option>
            </select>
          </label>
          {form.level === 'hsc' ? (
            <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
              <span>Subjects</span>
              <input
                value={form.subjects}
                onChange={(event) => setForm((prev) => ({ ...prev, subjects: event.target.value }))}
                placeholder="Physics, Chemistry, Higher Math"
              />
            </label>
          ) : (
            <>
              <label className="admin-field">
                <span>Admission type</span>
                <select value={form.admissionType} onChange={(event) => setForm((prev) => ({ ...prev, admissionType: event.target.value }))}>
                  <option value="medical">Medical</option>
                  <option value="engineering">Engineering</option>
                  <option value="varsity">Varsity</option>
                </select>
              </label>
              <label className="admin-field">
                <span>Admission subtype</span>
                <select
                  value={form.admissionSubtype}
                  onChange={(event) => setForm((prev) => ({ ...prev, admissionSubtype: event.target.value }))}
                  disabled={form.admissionType !== 'varsity'}
                >
                  <option value="">None</option>
                  <option value="science">Science</option>
                  <option value="commerce">Commerce</option>
                  <option value="arts">Arts</option>
                  <option value="iba">IBA</option>
                </select>
              </label>
            </>
          )}
          <label className="admin-field">
            <span>Date</span>
            <input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
          </label>
          <label className="admin-field">
            <span>Timezone</span>
            <select value={form.timezone} onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}>
              {TIMEZONE_OPTIONS.map((timezone) => (
                <option key={timezone} value={timezone}>{timezone}</option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Duration hours</span>
            <input type="number" min="0" value={form.durationHours} onChange={(event) => setForm((prev) => ({ ...prev, durationHours: event.target.value }))} />
          </label>
          <label className="admin-field">
            <span>Duration minutes</span>
            <input type="number" min="0" max="59" value={form.durationMinutes} onChange={(event) => setForm((prev) => ({ ...prev, durationMinutes: event.target.value }))} />
          </label>
          <label className="admin-field">
            <span>Start hour</span>
            <input type="number" min="1" max="12" value={form.startHour} onChange={(event) => setForm((prev) => ({ ...prev, startHour: event.target.value }))} />
          </label>
          <label className="admin-field">
            <span>Start minute</span>
            <input type="number" min="0" max="59" value={form.startMinute} onChange={(event) => setForm((prev) => ({ ...prev, startMinute: event.target.value }))} />
          </label>
          <label className="admin-field">
            <span>AM / PM</span>
            <select value={form.startPeriod} onChange={(event) => setForm((prev) => ({ ...prev, startPeriod: event.target.value }))}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </label>
          {!isEdit ? (
            <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
              <span>Clone question set from existing contest</span>
              <select value={form.cloneFromContestId} onChange={(event) => setForm((prev) => ({ ...prev, cloneFromContestId: event.target.value }))}>
                <option value="">No clone</option>
                {cloneOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
            <span>Admin note</span>
            <textarea
              value={form.reason}
              onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
              rows={3}
              placeholder={isEdit ? 'Optional update note' : 'Optional creation note'}
            />
          </label>
        </div>

        <div className="admin-modal__actions">
          <button type="button" className="admin-button admin-button--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="admin-button"
            onClick={() => onSubmit({
              name: form.name,
              level: form.level,
              questionType: form.questionType,
              subjects: form.level === 'hsc'
                ? form.subjects.split(',').map((item) => item.trim()).filter(Boolean)
                : [],
              admissionType: form.level === 'admission' ? form.admissionType : '',
              admissionSubtype: form.level === 'admission' ? form.admissionSubtype : '',
              date: form.date,
              duration: {
                hours: Number(form.durationHours),
                minutes: Number(form.durationMinutes)
              },
              startTime: {
                hour: Number(form.startHour),
                minute: Number(form.startMinute),
                period: form.startPeriod,
                timezone: form.timezone
              },
              adminStatus: form.adminStatus,
              cloneFromContestId: form.cloneFromContestId,
              reason: form.reason.trim()
            })}
          >
            {isEdit ? 'Save changes' : 'Create contest'}
          </button>
        </div>
      </div>
    </div>
  );
}
