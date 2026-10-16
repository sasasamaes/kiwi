// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from './api-client';

export type InviteState = 'valid' | 'invalid' | null;
export interface ReferralOffer {
  title: string;
  detail: string;
}

/**
 * Lee ?email=, ?invitation= y ?referral= del link y valida contra el API.
 * El referido se revalida con debounce mientras el usuario lo tipea, para
 * mostrar la oferta de SU app antes de registrarse. Usar bajo <Suspense>.
 */
export function useInviteReferral(role: 'merchant' | 'driver' | 'customer') {
  const searchParams = useSearchParams();
  const invitedEmail = searchParams.get('email') ?? '';
  const invitationToken = searchParams.get('invitation') ?? '';
  const initialReferral = useMemo(
    () => (searchParams.get('referral') ?? '').trim().toUpperCase(),
    [searchParams],
  );

  const [inviteState, setInviteState] = useState<InviteState>(null);
  const [referral, setReferral] = useState(initialReferral);
  const [referralOffer, setReferralOffer] = useState<ReferralOffer | null>(null);
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referralChecking, setReferralChecking] = useState(false);

  useEffect(() => {
    setReferral(initialReferral);
  }, [initialReferral]);

  useEffect(() => {
    if (!invitationToken) return;
    let alive = true;
    api
      .validateInvitation(invitationToken, invitedEmail || undefined, role)
      .then((r) => {
        if (alive) setInviteState(r?.valid ? 'valid' : 'invalid');
      })
      .catch(() => {
        if (alive) setInviteState(null);
      });
    return () => {
      alive = false;
    };
  }, [invitationToken, invitedEmail, role]);

  useEffect(() => {
    const code = referral.trim();
    if (!code) {
      setReferralOffer(null);
      setReferralValid(null);
      return;
    }
    setReferralChecking(true);
    const t = setTimeout(() => {
      api
        .validateReferral(code, role)
        .then((r) => {
          setReferralValid(!!r?.valid);
          setReferralOffer(r?.valid ? (r.offer ?? null) : null);
        })
        .catch(() => {
          setReferralValid(null);
          setReferralOffer(null);
        })
        .finally(() => setReferralChecking(false));
    }, 500);
    return () => clearTimeout(t);
  }, [referral, role]);

  return {
    invitedEmail,
    invitationToken,
    inviteState,
    referral,
    setReferral,
    referralOffer,
    referralValid,
    referralChecking,
  };
}
