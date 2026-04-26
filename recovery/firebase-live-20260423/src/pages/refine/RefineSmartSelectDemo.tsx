import React, { useEffect } from "react";
import { useForm } from "@refinedev/react-hook-form";
import { useList, useOne } from "@refinedev/core";
import styled from "styled-components";

// 스타일 정의
const Container = styled.div`
  padding: 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  max-width: 600px;
  margin: 20px auto;
`;

const Title = styled.h2`
  margin-bottom: 24px;
  font-size: 20px;
  color: #333;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #555;
`;

const Select = styled.select`
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background-color: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
`;

const InfoBox = styled.div`
  margin-top: 24px;
  padding: 16px;
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
  color: #1e40af;
  font-size: 14px;
  line-height: 1.6;
`;

// [Smart Select Logic]
// 1. User selects a Team
// 2. We fetch the Team's details (including Company info)
// 3. We auto-fill the Company field
export const RefineSmartSelectDemo = () => {
    // 1. Form Setup
    const {
        register,
        watch,
        setValue,
        formState: { errors }
    } = useForm({
        defaultValues: {
            responsibleTeamId: "",
            responsibleTeamName: "",
            companyId: "",
            companyName: "",
        }
    });

    // 2. Watch the Team selection
    const selectedTeamId = watch("responsibleTeamId");

    // 3. Fetch Team List for Dropdown
    const { data: teamList } = useList({
        resource: "teams",
        pagination: { mode: "off" } // Fetch all logic from our provider
    });

    // 4. [CORE LOGIC] Fetch details of the Selected Team
    // This only runs when `selectedTeamId` has a value
    const { data: teamDetail, isLoading: isLoadingTeam } = useOne({
        resource: "teams",
        id: selectedTeamId,
        queryOptions: {
            enabled: !!selectedTeamId, // Only trigger if ID exists
        }
    });

    // 5. [EFFECT] Auto-fill Company when Team Data loads
    useEffect(() => {
        if (teamDetail?.data) {
            const team = teamDetail.data;
            console.log("Team Loaded:", team);

            // Auto-fill logic
            setValue("responsibleTeamName", team.name); // Just to be safe

            if (team.companyId) {
                setValue("companyId", team.companyId);
                setValue("companyName", team.companyName || "Unknown Company");
            } else {
                setValue("companyId", "");
                setValue("companyName", "소속 회사 없음");
            }
        }
    }, [teamDetail, setValue]);

    return (
        <Container>
            <Title>🧩 Refine Smart Select Demo</Title>

            <FormGroup>
                <Label>담당 팀 선택 (Team)</Label>
                <Select {...register("responsibleTeamId")}>
                    <option value="">팀을 선택하세요...</option>
                    {teamList?.data?.map((team: any) => (
                        <option key={team.id} value={team.id}>
                            {team.name}
                        </option>
                    ))}
                </Select>
            </FormGroup>

            <FormGroup>
                <Label>소속 시공사 (Auto-Filled)</Label>
                <Input
                    {...register("companyName")}
                    readOnly
                    placeholder="팀을 선택하면 자동 입력됩니다."
                />
                {/* Hidden ID field for form submission */}
                <input type="hidden" {...register("companyId")} />
            </FormGroup>

            <InfoBox>
                <strong>💡 작동 원리 (How it works):</strong><br />
                1. <code>useList('teams')</code>로 드롭다운을 채웁니다.<br />
                2. <code>watch('teamId')</code>로 선택된 값을 감시합니다.<br />
                3. <code>useOne('teams', id)</code>가 선택된 팀의 상세 정보를 가져옵니다.<br />
                4. <code>useEffect</code>가 데이터 변경을 감지하고 <code>setValue</code>로 시공사를 자동 채웁니다.<br />
                <br />
                이 패턴을 사용하면 <strong>"선택 시 자동 조회 및 입력"</strong> 로직을<br />
                아주 깔끔하게 구현할 수 있습니다.
            </InfoBox>
        </Container>
    );
};
