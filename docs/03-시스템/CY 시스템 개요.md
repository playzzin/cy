---
type: architecture
status: active
tags: [시스템, 구조]
---

# CY 시스템 개요

## 목적

CY는 건설 ERP로서 인증·현장·인력·일보·급여·정산·지원·견적·시공계획과 관련 문서 업무를 관리한다.

## 기술 구성

- React 18 + TypeScript strict
- Firebase Auth
- Cloud Firestore
- Firebase Storage
- Cloud Functions for Firebase, Node 22
- Firebase Hosting
- Firestore Rules 및 Storage Rules

세부 개발 기준과 검증 명령은 [[../../개발지침|개발지침.md]]를 따른다.

## 주요 경계

- `src/pages`: 업무 화면
- `src/components`: 공통 UI
- `src/features`: 기능별 로직과 테스트
- `src/services`, `src/repositories`: 데이터 접근과 업무 서비스
- `src/security`: 프런트 권한 정책
- `functions/src`: 서버 권한·자동화·민감 처리
- `firestore.rules`: 최종 데이터 접근 통제
- `docs`: 운영·개발 지식 Vault

## 권한 변경 원칙

화면 숨김, 프런트 권한, Functions 검증, Firestore Rules를 함께 검토한다. 어느 한 계층만 변경해 보안을 완성했다고 판단하지 않는다.

## 관련 문서

- [[../01-운영/운영 원칙]]
- [[../06-검증/변경 검증 체크리스트]]
- [[../04-백업과 복구/백업 및 복구 원칙]]
