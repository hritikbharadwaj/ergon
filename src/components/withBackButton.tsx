import React from 'react';
import BackButton from './BackButton';

type WithBackButtonProps = {
  backLabel?: string;
  backSubtitle?: string;
  backTo?: string;
};

const withBackButton = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  defaultLabel = 'Back',
  defaultSubtitle?: string,
  defaultTo?: string
) => {
  return (props: P & WithBackButtonProps) => {
    const { backLabel = defaultLabel, backSubtitle = defaultSubtitle, backTo = defaultTo, ...rest } = props as any;

    return (
      <div className="w-full">
        <div className="mb-6">
          <BackButton
            label={backLabel}
            subtitle={backSubtitle}
            to={backTo}
          />
        </div>
        <WrappedComponent {...(rest as P)} />
      </div>
    );
  };
};

export default withBackButton;