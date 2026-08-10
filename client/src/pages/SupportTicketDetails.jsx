import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HiArrowLeft, HiPaperAirplane } from 'react-icons/hi';
import { fetchSupportTicketDetails, replyToSupportTicket } from '../services/supportApi';
import Sidebar from '../components/layout/Sidebar';
import './Support.css';

const SupportTicketDetails = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  const loadTicket = async () => {
    try {
      setLoading(true);
      const data = await fetchSupportTicketDetails(ticketId);
      if (data && data.ticket) {
        setTicket(data.ticket);
      }
    } catch (error) {
      console.error('Failed to load ticket details:', error);
      alert('Failed to load ticket details.');
      navigate('/support');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.replies]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;

    try {
      setSending(true);
      const data = await replyToSupportTicket(ticketId, replyMessage);
      if (data && data.ticket) {
        setTicket(data.ticket);
        setReplyMessage('');
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      alert('Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <Sidebar activeTab="support" />
        <main className="dashboard-main" style={{ padding: '24px', overflowY: 'auto' }}>
          <div className="support-page">Loading ticket details...</div>
        </main>
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  return (
    <div className="dashboard-container">
      <Sidebar activeTab="support" />
      <main className="dashboard-main" style={{ padding: '24px', overflowY: 'auto' }}>
        <div className="support-page">
        <div className="ticket-details-header">
          <button className="back-btn" onClick={() => navigate('/support')}>
            <HiArrowLeft /> Back
          </button>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Ticket Details</h1>
        </div>

        <div className="ticket-chat-container">
          <div className="ticket-info-panel">
            <h2 className="ticket-info-title">{ticket.title}</h2>
            <div className="ticket-meta" style={{ marginBottom: '16px' }}>
              <span className={`ticket-badge status-${ticket.status}`}>
                {ticket.status.replace('_', ' ')}
              </span>
              <span className={`ticket-badge priority-${ticket.priority}`}>
                {ticket.priority}
              </span>
              <span>Created {formatDate(ticket.createdAt)}</span>
              <span style={{ textTransform: 'capitalize' }}>Category: {ticket.category}</span>
            </div>
            <div className="ticket-original-message">
              {ticket.message}
            </div>
          </div>

          <div className="chat-messages">
            {ticket.replies && ticket.replies.map((reply, index) => {
              const isUser = reply.authorRole === 'user';
              return (
                <div key={index} className={`chat-message ${isUser ? 'user-reply' : 'admin-reply'}`}>
                  <div className="chat-bubble">
                    {reply.message}
                  </div>
                  <div className="chat-meta">
                    {isUser ? 'You' : 'Admin'} • {formatDate(reply.createdAt)}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {ticket.status !== 'closed' && (
            <form className="chat-input-area" onSubmit={handleSendReply}>
              <textarea 
                placeholder="Type your reply here..." 
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply(e);
                  }
                }}
              />
              <button 
                type="submit" 
                className="send-reply-btn"
                disabled={sending || !replyMessage.trim()}
              >
                {sending ? 'Sending...' : <><HiPaperAirplane style={{ transform: 'rotate(90deg)' }} size={20} /></>}
              </button>
            </form>
          )}
          {ticket.status === 'closed' && (
            <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', color: 'rgba(255,255,255,0.6)' }}>
              This ticket has been closed. You cannot reply to a closed ticket.
            </div>
          )}
        </div>
        </div>
      </main>
    </div>
  );
};

export default SupportTicketDetails;
