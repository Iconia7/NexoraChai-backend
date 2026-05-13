declare module 'africastalking' {
    interface SMSOptions {
        to: string[];
        message: string;
        from?: string;
        enque?: boolean;
    }

    interface AfricasTalkingInstance {
        SMS: {
            send: (options: SMSOptions) => Promise<any>;
        };
    }

    function AfricasTalking(options: { apiKey: string; username: string }): AfricasTalkingInstance;

    export default AfricasTalking;
}
