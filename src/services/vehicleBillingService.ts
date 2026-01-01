import {
    collection, doc, getDocs, setDoc, query, where, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Vehicle, VehicleExpenseRecord } from '../types/vehicle';
import { VehicleBillingDocument, VehicleBillingCostItem } from '../types/vehicleBilling';
import { vehicleService } from './vehicleService';

const BILLING_COLLECTION = 'vehicle_billings';

export const vehicleBillingService = {
    // Generate Billing for a specific vehicle and month
    generateBilling: async (vehicle: Vehicle, yearMonth: string): Promise<VehicleBillingDocument> => {
        // 1. Get Expenses for the month
        const expenses = await vehicleService.getExpensesByVehicle(vehicle.id, yearMonth);

        // 2. Calculate Costs
        const lineItems: VehicleBillingCostItem[] = [];

        // Fixed Cost (if valid contract)
        let fixedCost = 0;
        if (vehicle.type !== 'OWNED' && vehicle.contract) {
            // Check if contract covers this month? (Simplified Logic: if active, charge full)
            // TODO: Pro-rating logic can be added here
            fixedCost = vehicle.contract.monthlyFee;
            lineItems.push({
                id: 'fixed-rent',
                label: `Monthly Fee (${vehicle.type})`,
                amount: fixedCost,
                type: 'FIXED',
                category: 'RENT'
            });
        }

        // Variable Costs
        let variableCost = 0;
        expenses.forEach(exp => {
            variableCost += exp.amount;
            lineItems.push({
                id: exp.id,
                label: `${exp.type} - ${exp.date}`,
                amount: exp.amount,
                type: 'VARIABLE',
                category: exp.type
            });
        });

        const totalAmount = fixedCost + variableCost;
        const billingId = `${yearMonth}_${vehicle.id}`;

        const billingDoc: VehicleBillingDocument = {
            id: billingId,
            yearMonth,
            vehicleId: vehicle.id,
            vehiclePlate: vehicle.licensePlate,
            assignedTeamId: vehicle.currentAssigneeType === 'TEAM' ? vehicle.currentAssigneeId : undefined,
            assignedTeamName: vehicle.currentAssigneeType === 'TEAM' ? vehicle.currentAssigneeName : undefined,

            fixedCost,
            variableCost,
            totalAmount,
            status: 'DRAFT',
            lineItems,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        return billingDoc;
    },

    // Save Billing Document
    saveBilling: async (billing: VehicleBillingDocument) => {
        try {
            const docRef = doc(db, BILLING_COLLECTION, billing.id);
            await setDoc(docRef, billing);
        } catch (error) {
            console.error("Error saving billing:", error);
            throw error;
        }
    },

    // Get Billings for a Month
    getBillingsByMonth: async (yearMonth: string) => {
        try {
            const q = query(
                collection(db, BILLING_COLLECTION),
                where('yearMonth', '==', yearMonth)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => doc.data() as VehicleBillingDocument);
        } catch (error) {
            console.error("Error fetching billings:", error);
            return [];
        }
    },

    // Generate for ALL vehicles
    generateMonthlyBillings: async (yearMonth: string) => {
        try {
            const vehicles = await vehicleService.getVehicles();
            const promises = vehicles.map(v => vehicleBillingService.generateBilling(v, yearMonth));
            return await Promise.all(promises);
        } catch (error) {
            console.error("Error batch generating billings:", error);
            throw error;
        }
    }
};
