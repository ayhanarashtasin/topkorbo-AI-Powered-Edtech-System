import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiPlus, HiChatAlt2, HiTrash, HiX } from 'react-icons/hi';
import { fetchMySupportTickets, createSupportTicket, deleteSupportTicket } from '../services/supportApi';
import Sidebar from '../components/layout/Sidebar';
import './Support.css';

const Support = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    category: 'general',
    priority: 'normal'
  });
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await fetchMySupportTickets({ limit: 50 });
      if (data && data.tickets) {
        setTickets(data.tickets);
      }
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const data = await createSupportTicket(formData);
      if (data && data.ticket) {
        setIsModalOpen(false);
        setFormData({ title: '', message: '', category: 'general', priority: 'normal' });
        loadTickets();
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
      alert('Failed to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e, ticketId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this ticket?')) return;
    try {
      const data = await deleteSupportTicket(ticketId);
      if (data && data.message) {
        setTickets(tickets.filter(t => t._id !== ticketId));
      }
    } catch (error) {
      console.error('Failed to delete ticket:', error);
      alert('Failed to delete ticket.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeTab="support" />
      <main className="dashboard-main" style={{ padding: '24px', overflowY: 'auto' }}>
        <div className="support-page">
        <div className="support-header">
          <h1>Support Tickets</h1>
          <button className="create-ticket-btn" onClick={() => setIsModalOpen(true)}>
            <HiPlus /> New Ticket
          </button>
        </div>

        {loading ? (
          <div>Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="no-tickets">
            <HiChatAlt2 size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <h3>No Support Tickets</h3>
            <p>You haven't submitted any support tickets yet.</p>
          </div>
        ) : (
          <div className="support-list">
            {tickets.map(ticket => (
              <div 
                key={ticket._id} 
                className="ticket-card" 
                onClick={() => navigate(`/support/${ticket._id}`)}
              >
                <div className="ticket-card-main">
                  <h3 className="ticket-title">{ticket.title}</h3>
                  <div className="ticket-meta">
                    <span className={`ticket-badge status-${ticket.status}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                    <span className={`ticket-badge priority-${ticket.priority}`}>
                      {ticket.priority}
                    </span>
                    <span>{formatDate(ticket.createdAt)}</span>
                  </div>
                </div>
                <div className="ticket-actions">
                  <button 
                    className="delete-ticket-btn" 
                    onClick={(e) => handleDelete(e, ticket._id)}
                    title="Delete Ticket"
                  >
                    <HiTrash size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {isModalOpen && (
          <div className="support-modal-overlay">
            <div className="support-modal">
              <div className="support-modal-header">
                <h2>Create Support Ticket</h2>
                <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>
                  <HiX size={24} />
                </button>
              </div>
              <form onSubmit={handleCreate}>
                <div className="support-form-group">
                  <label>Title</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Brief description of the issue"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                
                <div className="support-form-group" style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label>Category</label>
                    <select 
                      value={formData.category} 
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                    >
                      <option value="general">General</option>
                      <option value="account">Account</option>
                      <option value="technical">Technical</option>
                      <option value="billing">Billing</option>
                      <option value="content">Content</option>
                      <option value="contest">Contest</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Priority</label>
                    <select 
                      value={formData.priority} 
                      onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="support-form-group">
                  <label>Message</label>
                  <textarea 
                    required 
                    placeholder="Describe your issue in detail..."
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                  />
                </div>

                <button type="submit" className="submit-ticket-btn" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
      </main>
    </div>
  );
};

export default Support;
