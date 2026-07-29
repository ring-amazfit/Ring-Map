package com.ringmap.nav;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class UiFormatTest {
    @Test
    public void rendersUnavailableTransmissionMetricsAsThreeHyphens() {
        assertEquals("---", UiFormat.metric(-1L));
    }
}
