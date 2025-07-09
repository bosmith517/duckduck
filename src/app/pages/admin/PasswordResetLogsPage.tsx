import React, { useState, useEffect } from 'react';
import { PageTitle } from '../../../_metronic/layout/core';
import { supabase } from '../../../supabaseClient';
import { format } from 'date-fns';
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth';
import { showToast } from '../../utils/toast';

interface PasswordResetRequest {
  id: string;
  user_id: string;
  email: string;
  status: 'pending' | 'used' | 'expired' | 'cancelled';
  requested_at: string;
  expires_at: string;
  used_at: string | null;
  ip_address: string;
  user_agent: string;
  request_source: string;
  email_sent: boolean;
  attempt_count: number;
  user_profiles?: {
    first_name: string;
    last_name: string;
  };
}

const PasswordResetLogsPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth();
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'used' | 'expired' | 'cancelled'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadPasswordResetRequests();
    }
  }, [userProfile?.tenant_id, filter]);

  const loadPasswordResetRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('password_reset_requests')
        .select(`
          *,
          user_profiles (
            first_name,
            last_name
          )
        `)
        .eq('tenant_id', userProfile?.tenant_id)
        .order('requested_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRequests(data || []);
    } catch (error) {
      console.error('Error loading password reset requests:', error);
      showToast.error('Failed to load password reset logs');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'badge-warning',
      used: 'badge-success',
      expired: 'badge-secondary',
      cancelled: 'badge-danger'
    };
    return badges[status as keyof typeof badges] || 'badge-secondary';
  };

  const getUserAgent = (userAgent: string) => {
    // Extract browser and OS from user agent string
    const match = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
    const browser = match ? match[1] : 'Unknown';
    
    let os = 'Unknown';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';
    
    return `${browser} on ${os}`;
  };

  const filteredRequests = requests.filter(request => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      request.email.toLowerCase().includes(searchLower) ||
      request.user_profiles?.first_name?.toLowerCase().includes(searchLower) ||
      request.user_profiles?.last_name?.toLowerCase().includes(searchLower) ||
      request.ip_address.includes(searchTerm)
    );
  });

  const cleanupExpiredRequests = async () => {
    try {
      const { error } = await supabase.rpc('cleanup_expired_password_resets');
      if (error) throw error;
      showToast.success('Expired requests cleaned up');
      loadPasswordResetRequests();
    } catch (error) {
      console.error('Error cleaning up expired requests:', error);
      showToast.error('Failed to clean up expired requests');
    }
  };

  if (userProfile?.role !== 'admin') {
    return (
      <div className="alert alert-danger">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Password Reset Logs</PageTitle>

      <div className="card">
        <div className="card-header border-0 pt-6">
          <div className="card-title">
            <div className="d-flex align-items-center position-relative my-1">
              <i className="ki-duotone ki-magnifier fs-3 position-absolute ms-5">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              <input
                type="text"
                className="form-control form-control-solid w-250px ps-13"
                placeholder="Search by email, name, or IP"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="card-toolbar">
            <div className="d-flex justify-content-end align-items-center">
              <select
                className="form-select form-select-solid me-5"
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="used">Used</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                type="button"
                className="btn btn-light-primary me-3"
                onClick={cleanupExpiredRequests}
              >
                <i className="ki-duotone ki-trash fs-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                  <span className="path4"></span>
                  <span className="path5"></span>
                </i>
                Clean Up Expired
              </button>
            </div>
          </div>
        </div>

        <div className="card-body py-4">
          {loading ? (
            <div className="text-center py-10">
              <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-600 fs-5">No password reset requests found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle table-row-dashed fs-6 gy-5">
                <thead>
                  <tr className="text-start text-muted fw-bold fs-7 text-uppercase gs-0">
                    <th className="min-w-125px">User</th>
                    <th className="min-w-125px">Status</th>
                    <th className="min-w-125px">Requested</th>
                    <th className="min-w-125px">Expires</th>
                    <th className="min-w-100px">Source</th>
                    <th className="min-w-150px">Location</th>
                    <th className="min-w-100px">Attempts</th>
                    <th className="text-end min-w-70px">Email Sent</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600 fw-semibold">
                  {filteredRequests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <div className="d-flex flex-column">
                          <span className="text-gray-800 mb-1">
                            {request.user_profiles?.first_name} {request.user_profiles?.last_name}
                          </span>
                          <span className="text-gray-600 fs-7">{request.email}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadge(request.status)}`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex flex-column">
                          <span className="text-gray-800 mb-1">
                            {format(new Date(request.requested_at), 'MMM dd, yyyy')}
                          </span>
                          <span className="text-gray-600 fs-7">
                            {format(new Date(request.requested_at), 'h:mm a')}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex flex-column">
                          <span className="text-gray-800 mb-1">
                            {format(new Date(request.expires_at), 'MMM dd, yyyy')}
                          </span>
                          <span className="text-gray-600 fs-7">
                            {format(new Date(request.expires_at), 'h:mm a')}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-light-info">
                          {request.request_source}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex flex-column">
                          <span className="text-gray-800 mb-1">{request.ip_address}</span>
                          <span className="text-gray-600 fs-7">
                            {getUserAgent(request.user_agent)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={request.attempt_count > 3 ? 'text-danger' : ''}>
                          {request.attempt_count}
                        </span>
                      </td>
                      <td className="text-end">
                        {request.email_sent ? (
                          <i className="ki-duotone ki-check-circle fs-2x text-success">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                        ) : (
                          <i className="ki-duotone ki-cross-circle fs-2x text-danger">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Rate Limits Card */}
      <div className="card mt-5">
        <div className="card-header">
          <h3 className="card-title">Password Reset Statistics</h3>
        </div>
        <div className="card-body">
          <div className="row g-5 g-xl-8">
            <div className="col-xl-3">
              <div className="card card-xl-stretch mb-xl-8">
                <div className="card-body">
                  <span className="text-gray-700 fw-bold fs-6">Total Requests</span>
                  <div className="text-gray-900 fw-bolder fs-2x mt-1">
                    {requests.length}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-3">
              <div className="card card-xl-stretch mb-xl-8">
                <div className="card-body">
                  <span className="text-gray-700 fw-bold fs-6">Pending</span>
                  <div className="text-warning fw-bolder fs-2x mt-1">
                    {requests.filter(r => r.status === 'pending').length}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-3">
              <div className="card card-xl-stretch mb-xl-8">
                <div className="card-body">
                  <span className="text-gray-700 fw-bold fs-6">Successfully Used</span>
                  <div className="text-success fw-bolder fs-2x mt-1">
                    {requests.filter(r => r.status === 'used').length}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-3">
              <div className="card card-xl-stretch mb-xl-8">
                <div className="card-body">
                  <span className="text-gray-700 fw-bold fs-6">Failed/Expired</span>
                  <div className="text-danger fw-bolder fs-2x mt-1">
                    {requests.filter(r => r.status === 'expired' || r.status === 'cancelled').length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PasswordResetLogsPage;