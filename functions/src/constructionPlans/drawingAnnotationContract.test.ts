import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
    CONSTRUCTION_PLAN_DRAWING_LAYER_CONTRACT,
    canonicalConstructionPlanDrawingAnnotationStyle,
    constructionPlanDrawingAnnotationLayerContractIssues,
    type ConstructionPlanDrawingLayer,
} from './drawingAnnotationContract';

const geometryFor = (layer: ConstructionPlanDrawingLayer): Record<string, unknown> => {
    const geometry = CONSTRUCTION_PLAN_DRAWING_LAYER_CONTRACT[layer].geometry;
    if (geometry === 'direction') {
        return {
            kind: 'polyline',
            vertices: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.7 }],
            arrowStart: false,
            arrowEnd: true,
        };
    }
    if (geometry === 'radius') return { kind: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.2, ry: 0.2 };
    return { kind: 'rect', x: 0.1, y: 0.1, w: 0.4, h: 0.3, rotationDeg: 0 };
};

const annotationFor = (layer: ConstructionPlanDrawingLayer): Record<string, unknown> => ({
    layer,
    geometry: geometryFor(layer),
    style: canonicalConstructionPlanDrawingAnnotationStyle(layer),
    zoneCode: 'A-01',
    sequence: 1,
    startDate: layer === 'restricted' ? '08:00' : '2026-09-01',
    endDate: '18:00',
    reason: '구조검토 조건 유지',
    releaseCondition: '승인강도 확인 후 해제',
    equipmentType: '이동식 크레인',
    equipmentId: 'equipment-1',
    entrance: '동문',
    destination: 'A동 작업층',
    radius: 12.5,
    responsibleWorkerId: 'worker-1',
    responsibleRole: '통제담당',
    materialType: '시스템동바리 수직재',
});

test('client and server use the exact same eight-layer style and geometry contract', () => {
    const clientContract = JSON.parse(readFileSync(resolve(
        __dirname,
        '../../../src/features/construction-plan/components/drawings/drawingLayerContract.json',
    ), 'utf8'));
    assert.deepEqual(clientContract, CONSTRUCTION_PLAN_DRAWING_LAYER_CONTRACT);
});

test('all eight layer contracts accept complete structured attributes and reject omissions', () => {
    (Object.keys(CONSTRUCTION_PLAN_DRAWING_LAYER_CONTRACT) as ConstructionPlanDrawingLayer[])
        .forEach((layer) => {
            const complete = annotationFor(layer);
            assert.deepEqual(constructionPlanDrawingAnnotationLayerContractIssues(complete), [], layer);

            const missing = { ...complete };
            if (layer === 'install' || layer === 'dismantle') delete missing.zoneCode;
            else if (layer === 'retain') delete missing.releaseCondition;
            else if (layer === 'equipment') delete missing.equipmentType;
            else if (layer === 'pedestrian') delete missing.destination;
            else if (layer === 'lifting') delete missing.radius;
            else if (layer === 'restricted') delete missing.responsibleWorkerId;
            else delete missing.materialType;
            assert.ok(constructionPlanDrawingAnnotationLayerContractIssues(missing).length > 0, layer);
        });
});

test('contract rejects custom styles, wrong direction geometry and URL-bearing attributes', () => {
    const custom = annotationFor('retain');
    custom.style = { ...custom.style as Record<string, unknown>, strokeToken: 'red' };
    assert.ok(constructionPlanDrawingAnnotationLayerContractIssues(custom).includes('style'));

    const wrongDirection = annotationFor('equipment');
    wrongDirection.geometry = { kind: 'polyline', vertices: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.7 }], arrowEnd: false };
    assert.ok(constructionPlanDrawingAnnotationLayerContractIssues(wrongDirection).includes('geometry'));

    const privateUrl = annotationFor('storage');
    privateUrl.materialType = 'https://storage.example/private.png?token=secret';
    assert.ok(constructionPlanDrawingAnnotationLayerContractIssues(privateUrl).includes('materialType.unsafe'));
});
