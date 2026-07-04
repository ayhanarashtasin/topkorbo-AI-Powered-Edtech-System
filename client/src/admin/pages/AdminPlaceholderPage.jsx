import AdminComingSoon from '../components/AdminComingSoon';
import AdminPageHeader from '../components/AdminPageHeader';

export default function AdminPlaceholderPage({ title, description, bullets = [] }) {
  return (
    <section className="admin-page">
      <AdminPageHeader
        title={title}
        description="This route is protected, styled, and ready for the next implementation phase."
      />

      <AdminComingSoon title={title} description={description} bullets={bullets} />
    </section>
  );
}
