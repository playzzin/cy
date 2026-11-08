import React from 'react';
import { MATERIAL_CERTIFICATE_LOGO_URL } from './materialCertificateBrand';

const MaterialCertificateHeading: React.FC<{ kind: 'inbound' | 'outbound' }> = ({ kind }) => (
    <header className="material-certificate-heading">
        <h1>{kind === 'inbound' ? '자재 입고증' : '자재 반출증'}</h1>
        <img src={MATERIAL_CERTIFICATE_LOGO_URL} alt="청연이엔지 로고" width={1200} height={200} />
    </header>
);

export default MaterialCertificateHeading;
