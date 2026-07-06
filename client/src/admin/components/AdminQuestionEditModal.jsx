import { useEffect, useState } from 'react';
import AdminActionButton from './AdminActionButton';

function buildInitialState(question) {
  return {
    questionText: question?.questionText || '',
    subject: question?.subject || 'Physics',
    paper: question?.paper || '1st',
    chapter: question?.chapter || '',
    topic: question?.topic || '',
    difficulty: question?.difficulty || 'medium',
    solution: question?.solution || '',
    options: Array.isArray(question?.options) ? question.options : [],
    cq: question?.cq || { description: '', parts: [] },
    reason: ''
  };
}

const SUBJECTS = ['Physics', 'Chemistry', 'Higher Math', 'Biology', 'Bangla', 'English', 'ICT', 'Statistics', 'Accounting', 'Finance', 'Economics', 'Management'];

export default function AdminQuestionEditModal({ open, question, onClose, onSave }) {
  const [form, setForm] = useState(buildInitialState(question));

  useEffect(() => {
    if (open) {
      setForm(buildInitialState(question));
    }
  }, [open, question]);

  if (!open || !question) return null;

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal admin-modal--large" onClick={(event) => event.stopPropagation()}>
        <h3>Edit question</h3>
        <p>Make safe content adjustments without changing the rest of the question bank workflow.</p>

        <div className="admin-modal-form-grid">
          <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
            <span>Question text</span>
            <textarea
              rows={5}
              value={form.questionText}
              onChange={(event) => setForm((prev) => ({ ...prev, questionText: event.target.value }))}
            />
          </label>

          <label className="admin-field">
            <span>Subject</span>
            <select value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}>
              {SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
          </label>

          <label className="admin-field">
            <span>Paper</span>
            <select value={form.paper} onChange={(event) => setForm((prev) => ({ ...prev, paper: event.target.value }))}>
              <option value="1st">1st</option>
              <option value="2nd">2nd</option>
            </select>
          </label>

          <label className="admin-field">
            <span>Chapter</span>
            <input value={form.chapter} onChange={(event) => setForm((prev) => ({ ...prev, chapter: event.target.value }))} />
          </label>

          <label className="admin-field">
            <span>Topic</span>
            <input value={form.topic} onChange={(event) => setForm((prev) => ({ ...prev, topic: event.target.value }))} />
          </label>

          <label className="admin-field">
            <span>Difficulty</span>
            <select value={form.difficulty} onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value }))}>
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
          </label>

          <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
            <span>Solution</span>
            <textarea
              rows={4}
              value={form.solution}
              onChange={(event) => setForm((prev) => ({ ...prev, solution: event.target.value }))}
            />
          </label>

          {question.type === 'mcq' || question.type === 'written' ? (
            <div className="admin-field" style={{ gridColumn: '1 / -1' }}>
              <span>Options</span>
              <div className="admin-option-editor">
                {form.options.map((option, index) => (
                  <div key={index} className="admin-option-editor__row">
                    <input
                      value={option.text || ''}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          options: prev.options.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, text: event.target.value } : item
                          )
                        }))
                      }
                    />
                    <label className="admin-option-editor__check">
                      <input
                        type="checkbox"
                        checked={!!option.isCorrect}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            options: prev.options.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, isCorrect: event.target.checked } : item
                            )
                          }))
                        }
                      />
                      <span>Correct</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {question.type === 'cq' ? (
            <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
              <span>CQ description</span>
              <textarea
                rows={4}
                value={form.cq?.description || ''}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    cq: { ...(prev.cq || {}), description: event.target.value, parts: prev.cq?.parts || [] }
                  }))
                }
              />
            </label>
          ) : null}

          <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
            <span>Admin note</span>
            <textarea
              rows={3}
              placeholder="Why was this edit needed?"
              value={form.reason}
              onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
            />
          </label>
        </div>

        <div className="admin-modal__actions">
          <AdminActionButton variant="ghost" onClick={onClose}>Cancel</AdminActionButton>
          <AdminActionButton
            onClick={() =>
              onSave({
                updates: {
                  questionText: form.questionText,
                  subject: form.subject,
                  paper: form.paper,
                  chapter: form.chapter,
                  topic: form.topic,
                  difficulty: form.difficulty,
                  solution: form.solution,
                  options: form.options,
                  cq: form.cq
                },
                reason: form.reason
              })
            }
          >
            Save changes
          </AdminActionButton>
        </div>
      </div>
    </div>
  );
}
